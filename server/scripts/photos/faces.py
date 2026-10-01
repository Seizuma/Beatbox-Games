#!/usr/bin/env python3
"""
server/scripts/photos/faces.py

Étape 2/2 — Détection de visage sur les photos candidates du Buzzer Battle.

Passe sur chaque entrée en attente déposée par collect.js et :
  - écarte les images YouTube sans visage (plan sur le public, logo, écran titre) ;
  - recadre le visage principal des miniatures et images clés en portrait
    serré, ajouté comme candidate supplémentaire ;
  - baisse la confiance d'une photo sans visage ou à plusieurs visages
    (battle, photo de groupe) ;
  - supprime les quasi-doublons (même photo recompressée sur deux sources).

Détecteur : YuNet (OpenCV Zoo, 230 Ko, téléchargé au premier lancement),
à défaut la cascade de Haar livrée avec OpenCV.

    pip install opencv-python numpy
    python scripts/photos/faces.py              # entrées pas encore analysées
    python scripts/photos/faces.py --force      # tout réanalyser
    python scripts/photos/faces.py --deep       # + images extraites des vidéos (yt-dlp + ffmpeg)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    sys.exit("OpenCV manquant : pip install opencv-python numpy")

# La console Windows est en cp1252 par défaut : les emoji des messages la font planter.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

SERVER_DIR = Path(__file__).resolve().parents[2]
REVIEW_DIR = SERVER_DIR / "beatbox_artists" / "review" / "photos"
MODELS_DIR = SERVER_DIR / "beatbox_artists" / "review" / ".models"
YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)

MIN_FACE_PX = 40           # visage plus petit : flou une fois agrandi en jeu
MIN_FACE_RATIO = 0.06      # largeur du visage / largeur de l'image (plans larges de scène)
DUPLICATE_DISTANCE = 6     # distance de Hamming max entre deux dHash « identiques »
MAX_YOUTUBE_VISIBLE = 6    # au-delà, la revue devient du bruit
CROP_MAX_SIDE = 800
DEEP_FRAMES = 6            # images extraites par vidéo en mode --deep
CROP_KINDS = ("face-crop", "group-crop")  # produits ici, refaits à chaque --force


# ---------------------------------------------------------------- détection

class FaceDetector:
    def __init__(self, min_score):
        self.min_score = min_score
        self.yunet = None
        self.haar = None
        model = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
        try:
            if not model.exists():
                MODELS_DIR.mkdir(parents=True, exist_ok=True)
                print(f"⬇️  Téléchargement du modèle YuNet dans {model}")
                urllib.request.urlretrieve(YUNET_URL, model)
            self.yunet = cv2.FaceDetectorYN.create(str(model), "", (320, 320), min_score, 0.3, 50)
            print("🙂 Détecteur : YuNet")
        except Exception as error:  # pas de réseau, OpenCV trop ancien…
            print(f"⚠️  YuNet indisponible ({error}), repli sur la cascade de Haar")
            self.haar = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    def detect(self, image):
        """Liste de (x, y, w, h, score), du plus grand visage au plus petit."""
        height, width = image.shape[:2]
        faces = []
        if self.yunet is not None:
            # YuNet travaille mieux sous 1280 px : on réduit puis on remet à l'échelle.
            scale = min(1.0, 1280 / max(width, height))
            resized = cv2.resize(image, (int(width * scale), int(height * scale))) if scale < 1 else image
            self.yunet.setInputSize((resized.shape[1], resized.shape[0]))
            _, found = self.yunet.detect(resized)
            for row in found if found is not None else []:
                x, y, w, h = (row[:4] / scale).tolist()
                faces.append((x, y, w, h, float(row[-1])))
        else:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            for (x, y, w, h) in self.haar.detectMultiScale(gray, 1.1, 6, minSize=(MIN_FACE_PX, MIN_FACE_PX)):
                faces.append((float(x), float(y), float(w), float(h), 0.8))

        faces = [
            face for face in faces
            if face[4] >= self.min_score and min(face[2], face[3]) >= MIN_FACE_PX and face[2] / width >= MIN_FACE_RATIO
        ]
        return sorted(faces, key=lambda face: face[2] * face[3], reverse=True)


# ---------------------------------------------------------------- images

def read_image(path):
    """cv2.imread ne gère pas les chemins non ASCII sous Windows : on décode à la main."""
    data = np.fromfile(str(path), dtype=np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR) if data.size else None


def write_jpeg(path, image):
    ok, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if ok:
        buffer.tofile(str(path))
    return ok


def dhash(image):
    """Empreinte perceptuelle 64 bits : survit au redimensionnement et à la recompression."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return int("".join("1" if bit else "0" for bit in bits), 2)


def crop_portrait(image, face):
    """Carré tête + épaules autour du visage, décalé vers le bas pour garder le buste."""
    height, width = image.shape[:2]
    x, y, w, h, _ = face
    side = int(min(max(w, h) * 3.0, width, height))
    center_x = x + w / 2
    center_y = y + h / 2 + h * 0.35
    left = int(min(max(center_x - side / 2, 0), width - side))
    top = int(min(max(center_y - side / 2, 0), height - side))
    crop = image[top:top + side, left:left + side]
    if side > CROP_MAX_SIDE:
        crop = cv2.resize(crop, (CROP_MAX_SIDE, CROP_MAX_SIDE), interpolation=cv2.INTER_AREA)
    return crop


def group_faces(faces, expected):
    """
    Visages des membres : les plus grands, jusqu'au nombre attendu. Un visage
    deux fois plus petit que le plus grand est le public ou un juge, pas un
    membre du groupe.
    """
    largest = faces[0][2]
    members = [face for face in faces if face[2] >= largest * 0.45]
    return members[:expected] if expected else members[:6]


def crop_group(image, faces):
    """Cadre paysage englobant tous les membres, têtes et bustes compris."""
    height, width = image.shape[:2]
    face_w = sum(face[2] for face in faces) / len(faces)
    face_h = sum(face[3] for face in faces) / len(faces)
    left = min(face[0] for face in faces) - face_w * 0.8
    right = max(face[0] + face[2] for face in faces) + face_w * 0.8
    top = min(face[1] for face in faces) - face_h * 0.7
    bottom = max(face[1] + face[3] for face in faces) + face_h * 1.8

    # Au moins du 4:3 : le jeu affiche les photos en paysage.
    box_w, box_h = right - left, bottom - top
    if box_w < box_h * 4 / 3:
        grow = (box_h * 4 / 3 - box_w) / 2
        left, right = left - grow, right + grow

    left, top = int(max(0, left)), int(max(0, top))
    right, bottom = int(min(width, right)), int(min(height, bottom))
    crop = image[top:bottom, left:right]
    longest = max(crop.shape[:2])
    if longest > 1000:
        scale = 1000 / longest
        crop = cv2.resize(crop, (int(crop.shape[1] * scale), int(crop.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    return crop


def expected_people(entry):
    """
    0 pour un beatboxer seul, sinon le nombre de membres (2 par défaut).
    Le choix fait dans l'administration (groupOverride) l'emporte sur la détection.
    """
    override = entry.get("groupOverride")
    is_group = override if override is not None else bool(entry.get("group"))
    if not is_group:
        return 0
    return max(2, len((entry.get("group") or {}).get("members") or []))

# ---------------------------------------------------------------- entrées

def load_entry(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def save_entry(path, entry):
    temp = path.with_suffix(f".{os.getpid()}.tmp")
    with open(temp, "w", encoding="utf-8") as handle:
        json.dump(entry, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.replace(temp, path)


def discard(entry_dir, candidate, reason):
    candidate["discarded"] = reason
    file = entry_dir / candidate.get("file", "")
    if candidate.get("file") and file.exists():
        file.unlink()


def analyse_candidate(entry_dir, candidate, detector, added, group_size=0):
    image = read_image(entry_dir / candidate["file"])
    if image is None:
        discard(entry_dir, candidate, "unreadable")
        return

    faces = detector.detect(image)
    candidate["faceChecked"] = True
    candidate["faces"] = len(faces)
    candidate["faceScore"] = round(faces[0][4], 3) if faces else None
    from_video = candidate.get("source") == "youtube" and candidate.get("kind") in ("thumbnail", "frame", "frame-deep")

    if from_video and not faces:
        discard(entry_dir, candidate, "no-face")
        return

    # Valeurs posées par collect.js, gardées à part : une réanalyse (--force)
    # repart d'elles au lieu de cumuler pénalités et remarques.
    candidate.setdefault("baseConfidence", candidate.get("confidence", 0.5))
    candidate.setdefault("baseNote", candidate.get("note"))
    confidence = candidate["baseConfidence"]
    notes = [candidate["baseNote"]] if candidate.get("baseNote") else []
    if not faces:
        confidence -= 0.2
        notes.append("aucun visage détecté")
    elif group_size and len(faces) < 2:
        # Duo ou crew : un portrait seul ne montre qu'un des membres.
        confidence -= 0.25
        notes.append(f"un seul visage, {group_size} personnes attendues")
    elif group_size:
        notes.append(f"{len(faces)} visages")
    elif len(faces) > 1:
        confidence -= 0.1
        notes.append(f"{len(faces)} visages")
    candidate["confidence"] = round(confidence, 2)
    candidate["note"] = " · ".join(notes) or None

    # Groupe : un seul cadre englobant les membres, jamais un visage isolé.
    if from_video and group_size:
        members = group_faces(faces, group_size)
        if len(members) < 2:
            return
        crop_id = f"{candidate['id']}-group"
        crop = crop_group(image, members)
        if write_jpeg(entry_dir / f"{crop_id}.jpg", crop):
            score = sum(face[4] for face in members) / len(members)
            # Tous les membres présents : la meilleure configuration possible.
            complete = len(members) >= group_size
            added.append({
                "id": crop_id,
                "source": "youtube",
                "kind": "group-crop",
                "parent": candidate["id"],
                "file": f"{crop_id}.jpg",
                "url": candidate.get("url"),
                "page": candidate.get("page"),
                "width": int(crop.shape[1]),
                "height": int(crop.shape[0]),
                "confidence": round(0.45 + 0.15 * score + (0.05 if complete else -0.1), 2),
                "faceChecked": True,
                "faces": len(members),
                "faceScore": round(score, 3),
                "note": f"recadrage groupe · {len(members)}/{group_size} visages",
            })
        return

    # Recadrage : seulement pour les images vidéo, où le beatboxer n'occupe
    # souvent qu'un tiers du cadre. Les photos de profil sont déjà cadrées.
    if from_video:
        crop_id = f"{candidate['id']}-face"
        crop_file = f"{crop_id}.jpg"
        crop = crop_portrait(image, faces[0])
        if write_jpeg(entry_dir / crop_file, crop):
            confidence = 0.45 + 0.15 * faces[0][4] - (0.15 if len(faces) > 1 else 0)
            added.append({
                "id": crop_id,
                "source": "youtube",
                "kind": "face-crop",
                "parent": candidate["id"],
                "file": crop_file,
                "url": candidate.get("url"),
                "page": candidate.get("page"),
                "width": int(crop.shape[1]),
                "height": int(crop.shape[0]),
                "confidence": round(confidence, 2),
                "faceChecked": True,
                "faces": 1,
                "faceScore": round(faces[0][4], 3),
                "note": "recadrage visage" + (f" · {len(faces)} visages dans l'image" if len(faces) > 1 else ""),
            })


def deduplicate(entry_dir, candidates):
    """Garde la meilleure version de chaque photo (ordre de confiance décroissant)."""
    kept = []
    for candidate in sorted(candidates, key=lambda item: item.get("confidence", 0), reverse=True):
        if candidate.get("discarded"):
            continue
        image = read_image(entry_dir / candidate["file"])
        if image is None:
            discard(entry_dir, candidate, "unreadable")
            continue
        fingerprint = dhash(image)
        if any(bin(fingerprint ^ other).count("1") <= DUPLICATE_DISTANCE for other in kept):
            discard(entry_dir, candidate, "duplicate")
            continue
        kept.append(fingerprint)


def trim_youtube(entry_dir, candidates):
    youtube = [c for c in candidates if c.get("source") == "youtube" and not c.get("discarded")]
    youtube.sort(key=lambda item: item.get("confidence", 0), reverse=True)
    for candidate in youtube[MAX_YOUTUBE_VISIBLE:]:
        discard(entry_dir, candidate, "surplus")


# ---------------------------------------------------------------- mode --deep

def deep_frames(entry_dir, entry):
    """
    Extrait des images au fil de la première vidéo, pour les entrées où les
    miniatures n'ont rien donné. yt-dlp donne l'URL du flux, ffmpeg y saute
    directement : seules quelques secondes sont téléchargées par image.
    """
    try:
        import yt_dlp  # noqa: F401  (optionnel)
    except ImportError:
        return []
    if not shutil.which("ffmpeg"):
        return []

    videos = (entry.get("sources") or {}).get("youtube", {}).get("videos") or []
    if not videos:
        return []
    video_id = videos[0]["id"]

    import yt_dlp
    options = {"quiet": True, "no_warnings": True, "format": "best[height<=720][vcodec!=none]/best"}
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
    except Exception as error:
        print(f"      yt-dlp : {error}")
        return []

    stream, duration = info.get("url"), info.get("duration") or 0
    if not stream or duration < 10:
        return []

    candidates = []
    for index in range(DEEP_FRAMES):
        moment = duration * (index + 1) / (DEEP_FRAMES + 1)
        file = f"yt-{video_id}-deep-{index + 1}.jpg"
        result = subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{moment:.1f}", "-i", stream,
             "-frames:v", "1", "-q:v", "2", str(entry_dir / file)],
            capture_output=True, timeout=90,
        )
        if result.returncode == 0 and (entry_dir / file).exists():
            candidates.append({
                "id": f"yt-{video_id}-deep-{index + 1}",
                "source": "youtube",
                "kind": "frame-deep",
                "file": file,
                "page": f"https://www.youtube.com/watch?v={video_id}&t={int(moment)}s",
                "confidence": 0.3,
                "note": f"image à {int(moment // 60)}:{int(moment % 60):02d}",
            })
    return candidates


# ---------------------------------------------------------------- main

def main():
    parser = argparse.ArgumentParser(description="Détection de visage sur les photos candidates")
    parser.add_argument("--force", action="store_true", help="réanalyser les images déjà vues")
    parser.add_argument("--deep", action="store_true", help="extraire des images des vidéos (yt-dlp + ffmpeg)")
    parser.add_argument("--min-score", type=float, default=0.8, help="score minimal d'un visage (0-1)")
    parser.add_argument("--keys", help="clés d'entrées séparées par des virgules")
    args = parser.parse_args()

    if not REVIEW_DIR.exists():
        sys.exit(f"Aucune collecte trouvée dans {REVIEW_DIR}. Lance d'abord : node scripts/photos/collect.js")

    detector = FaceDetector(args.min_score)
    keys = set(args.keys.split(",")) if args.keys else None
    entries = sorted(path for path in REVIEW_DIR.glob("*/entry.json") if not keys or path.parent.name in keys)

    totals = {"analysed": 0, "crops": 0, "no_face": 0, "duplicates": 0}
    for position, entry_path in enumerate(entries, start=1):
        entry = load_entry(entry_path)
        if entry.get("status") != "pending":
            continue
        entry_dir = entry_path.parent
        candidates = entry.get("candidates", [])
        group_size = expected_people(entry)
        if args.force:
            # Les recadrages vont être refaits à partir des images d'origine.
            for candidate in candidates:
                if candidate.get("kind") in CROP_KINDS and not candidate.get("discarded"):
                    discard(entry_dir, candidate, "replaced")
            candidates = [c for c in candidates if c.get("discarded") != "replaced"]
        todo = [
            c for c in candidates
            if not c.get("discarded") and c.get("kind") not in CROP_KINDS and (args.force or not c.get("faceChecked"))
        ]

        if args.deep and not any(c.get("kind") in CROP_KINDS and not c.get("discarded") for c in candidates):
            extra = deep_frames(entry_dir, entry)
            candidates.extend(extra)
            todo.extend(extra)

        if not todo:
            continue

        added = []
        for candidate in todo:
            analyse_candidate(entry_dir, candidate, detector, added, group_size)
            totals["analysed"] += 1
            totals["no_face"] += candidate.get("discarded") == "no-face"

        candidates.extend(added)
        totals["crops"] += len(added)
        before = sum(1 for c in candidates if c.get("discarded") == "duplicate")
        deduplicate(entry_dir, candidates)
        totals["duplicates"] += sum(1 for c in candidates if c.get("discarded") == "duplicate") - before
        trim_youtube(entry_dir, candidates)

        candidates.sort(key=lambda item: item.get("confidence", 0), reverse=True)
        entry["candidates"] = candidates
        # Le serveur compare cette valeur au réglage courant : si quelqu'un a
        # marqué la fiche comme groupe depuis, il réordonne en attendant un --force.
        entry["facesGroupSize"] = group_size
        save_entry(entry_path, entry)

        visible = sum(1 for c in candidates if not c.get("discarded"))
        print(f"   [{position}/{len(entries)}] {entry.get('name', entry_path.parent.name):<28} {visible} photo(s) à revoir")

    print(
        f"\n✅ {totals['analysed']} images analysées · {totals['crops']} recadrages visage · "
        f"{totals['no_face']} sans visage écartées · {totals['duplicates']} doublons retirés"
    )
    print("👉 Revue : /admin → Données → Photos")


if __name__ == "__main__":
    main()
