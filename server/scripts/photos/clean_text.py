#!/usr/bin/env python3
"""
server/scripts/photos/clean_text.py

Efface le texte d'une photo candidate, à la demande de l'administration.

Une photo du Buzzer Battle porte parfois le nom du beatboxer (miniature
YouTube, affiche de battle) : elle donnerait la réponse aux joueurs. Depuis
/admin → Données → Photos Buzzer, le bouton « Effacer le texte » dépose une
demande (clean-<id>.request.json) dans le dossier de la fiche ; ce script la
traite et ajoute l'image nettoyée comme nouvelle candidate.

Le serveur tourne dans un conteneur Node sans Python : c'est pourquoi le
travail se fait ici, sur l'hôte, en mode veille.

Deux sources de zones à effacer, cumulables :
  - les rectangles dessinés dans l'administration (toujours disponibles) ;
  - la détection automatique du texte par EasyOCR (si installé).
Remplissage : LaMa (simple-lama-inpainting) si installé, sinon l'inpainting
d'OpenCV, moins fin mais suffisant sur des zones de texte.

    python scripts/photos/clean_text.py --watch     # en continu, à laisser tourner
    python scripts/photos/clean_text.py             # traite les demandes en attente et s'arrête

Même méthode que filigrane_remover.py (EasyOCR + LaMa), branchée sur la revue.
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone

import cv2
import numpy as np

from faces import REVIEW_DIR, load_entry, read_image, save_entry, write_jpeg

TEXT_PADDING = 10            # px de marge autour du texte détecté, comme filigrane_remover.py
OCR_LANGUAGES = ["en", "ch_sim"]
OCR_MIN_CONFIDENCE = 0.0001  # tout ce qui ressemble à du texte : mieux vaut trop effacer
MAX_BOXES = 30


class CleanError(Exception):
    """Erreur à remonter telle quelle dans l'administration."""


# Les modèles sont lourds (plusieurs centaines de Mo) : chargés une seule fois
# au démarrage, puis gardés en mémoire pendant toute la veille.
_reader = None
_lama = None


def ocr_reader():
    global _reader
    if _reader is None:
        try:
            import easyocr
        except ImportError:
            _reader = False
        else:
            print("🔤 Chargement d'EasyOCR…")
            _reader = easyocr.Reader(OCR_LANGUAGES, gpu=False)
    return _reader or None


def lama_model():
    global _lama
    if _lama is None:
        try:
            from simple_lama_inpainting import SimpleLama
        except ImportError:
            _lama = False
        else:
            print("🖌️  Chargement de LaMa…")
            _lama = SimpleLama()
    return _lama or None


def build_mask(image, request):
    """Masque binaire (255 = à effacer) : zones dessinées + texte détecté."""
    height, width = image.shape[:2]
    mask = np.zeros((height, width), dtype=np.uint8)

    for box in (request.get("boxes") or [])[:MAX_BOXES]:
        x1 = int(max(0.0, float(box["x"])) * width)
        y1 = int(max(0.0, float(box["y"])) * height)
        x2 = int(min(1.0, float(box["x"]) + float(box["w"])) * width)
        y2 = int(min(1.0, float(box["y"]) + float(box["h"])) * height)
        mask[y1:y2, x1:x2] = 255

    detected = []
    if request.get("auto"):
        reader = ocr_reader()
        if reader is None and not request.get("boxes"):
            raise CleanError("Détection automatique indisponible sur le serveur (EasyOCR non installé) : dessine les zones à effacer.")
        if reader is not None:
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            for bbox, text, confidence in reader.readtext(rgb):
                if confidence < OCR_MIN_CONFIDENCE:
                    continue
                xs = [int(point[0]) for point in bbox]
                ys = [int(point[1]) for point in bbox]
                mask[max(0, min(ys) - TEXT_PADDING):min(height, max(ys) + TEXT_PADDING),
                     max(0, min(xs) - TEXT_PADDING):min(width, max(xs) + TEXT_PADDING)] = 255
                detected.append(text)

    if mask.max() == 0:
        raise CleanError("Aucun texte détecté : dessine les zones à effacer.")
    return mask, detected


def inpaint(image, mask):
    lama = lama_model()
    if lama is not None:
        from PIL import Image
        result = lama(Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB)), Image.fromarray(mask))
        result = cv2.cvtColor(np.array(result), cv2.COLOR_RGB2BGR)
        # LaMa travaille sur des dimensions multiples de 8 : on revient à la taille d'origine.
        return cv2.resize(result, (image.shape[1], image.shape[0])), "LaMa"
    # Repli : léger élargissement du masque pour ne pas laisser de liseré.
    dilated = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=1)
    return cv2.inpaint(image, dilated, 7, cv2.INPAINT_TELEA), "OpenCV"


def unique_id(candidates, base):
    ids = {candidate.get("id") for candidate in candidates}
    if base not in ids:
        return base
    index = 2
    while f"{base}{index}" in ids:
        index += 1
    return f"{base}{index}"


def process(request_path):
    entry_dir = request_path.parent
    entry_path = entry_dir / "entry.json"
    request = json.loads(request_path.read_text(encoding="utf-8"))
    candidate_id = request.get("candidateId")

    entry = load_entry(entry_path)
    if entry.get("status") != "pending":
        raise CleanError("La fiche a déjà été tranchée.")
    candidate = next((c for c in entry.get("candidates", []) if c.get("id") == candidate_id and not c.get("discarded")), None)
    if candidate is None:
        raise CleanError("Photo introuvable dans la fiche.")

    image = read_image(entry_dir / candidate["file"])
    if image is None:
        raise CleanError("Image illisible.")

    mask, detected = build_mask(image, request)
    result, method = inpaint(image, mask)

    # La fiche a pu bouger pendant le calcul (autre nettoyage, validation) : on la relit.
    entry = load_entry(entry_path)
    if entry.get("status") != "pending":
        raise CleanError("La fiche a été tranchée pendant le nettoyage.")
    candidates = entry.get("candidates", [])
    new_id = unique_id(candidates, f"{candidate_id}-clean")
    file = f"{new_id}.jpg"
    if not write_jpeg(entry_dir / file, result):
        raise CleanError("Écriture de l'image impossible.")

    note = f"texte effacé ({method})"
    if detected:
        note += " : " + ", ".join(detected[:5])
    candidates.append({
        "id": new_id,
        "source": candidate.get("source"),
        "kind": "text-cleaned",
        "parent": candidate_id,
        "file": file,
        "url": candidate.get("url"),
        "page": candidate.get("page"),
        "width": int(result.shape[1]),
        "height": int(result.shape[0]),
        # Juste au-dessus de l'original : c'est la version que l'on veut valider.
        "confidence": round(min(1.0, candidate.get("confidence", 0.5) + 0.01), 2),
        "faceChecked": True,
        "faces": candidate.get("faces"),
        "note": note,
    })
    candidates.sort(key=lambda item: item.get("confidence", 0), reverse=True)
    entry["candidates"] = candidates
    save_entry(entry_path, entry)
    return entry.get("name", entry_dir.name), new_id, method


def write_error(request_path, message):
    error_path = request_path.with_name(request_path.name.replace(".request.json", ".error.json"))
    error_path.write_text(
        json.dumps({"error": message, "at": datetime.now(timezone.utc).isoformat()}, ensure_ascii=False),
        encoding="utf-8",
    )


def run_once():
    handled = 0
    for request_path in sorted(REVIEW_DIR.glob("*/clean-*.request.json")):
        try:
            name, new_id, method = process(request_path)
            print(f"   ✅ {name} : {new_id} ({method})")
        except CleanError as error:
            print(f"   ⚠️  {request_path.parent.name} : {error}")
            write_error(request_path, str(error))
        except Exception as error:  # une image corrompue ne doit pas arrêter la veille
            print(f"   ❌ {request_path.parent.name} : {error}")
            write_error(request_path, f"Erreur inattendue : {error}")
        finally:
            request_path.unlink(missing_ok=True)
        handled += 1
    return handled


def main():
    parser = argparse.ArgumentParser(description="Efface le texte des photos candidates sur demande de l'administration")
    parser.add_argument("--watch", action="store_true", help="tourner en continu")
    parser.add_argument("--interval", type=float, default=3.0, help="secondes entre deux passages (--watch)")
    args = parser.parse_args()

    if not REVIEW_DIR.exists():
        sys.exit(f"Aucune collecte trouvée dans {REVIEW_DIR}. Lance d'abord : node scripts/photos/collect.js")

    print(f"🧽 Effacement du texte — OCR : {'EasyOCR' if ocr_reader() else 'indisponible (zones dessinées seulement)'}"
          f" · remplissage : {'LaMa' if lama_model() else 'OpenCV'}")

    if not args.watch:
        print(f"{run_once()} demande(s) traitée(s).")
        return

    print(f"👀 En veille sur {REVIEW_DIR} (Ctrl+C pour arrêter)")
    try:
        while True:
            run_once()
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nArrêt.")


if __name__ == "__main__":
    main()
