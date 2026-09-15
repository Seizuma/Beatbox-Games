import os
import sys
import numpy as np
import cv2
import easyocr
from PIL import Image
from simple_lama_inpainting import SimpleLama

# ==================== CONFIGURATION ====================
INPUT_FOLDER = "./server/beatbox_artists/En attente"        # Dossier source
OUTPUT_FOLDER = "./images_clean"  # Dossier de sortie
TEXT_PADDING = 10                 # Pixels de marge autour du texte détecté
MIN_CONFIDENCE = 0.0001              # Seuil de confiance EasyOCR (0 à 1)
LANGUAGES = ["en", "ch_sim"]      # Langues à détecter (ajouter si besoin)
# =======================================================

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

print("Chargement des modèles (première fois = téléchargement automatique)...")
reader = easyocr.Reader(LANGUAGES, gpu=False)
lama = SimpleLama()

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def build_text_mask(image_np, results, padding):
    """
    Crée un masque binaire (255 = zone à effacer) à partir des
    bounding boxes retournées par EasyOCR.
    """
    h, w = image_np.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    for (bbox, text, confidence) in results:
        if confidence < MIN_CONFIDENCE:
            continue
        # bbox = [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        xs = [int(pt[0]) for pt in bbox]
        ys = [int(pt[1]) for pt in bbox]
        x1 = max(0, min(xs) - padding)
        y1 = max(0, min(ys) - padding)
        x2 = min(w, max(xs) + padding)
        y2 = min(h, max(ys) + padding)
        mask[y1:y2, x1:x2] = 255
        print(f"    Texte détecté : '{text}' (confiance {confidence:.2f}) -> zone ({x1},{y1})-({x2},{y2})")

    return mask


def remove_watermark(image_path, output_path):
    print(f"\nTraitement : {os.path.basename(image_path)}")

    img_pil = Image.open(image_path).convert("RGB")
    img_np = np.array(img_pil)

    # --- Détection du texte ---
    print("  Détection du texte...")
    results = reader.readtext(img_np)

    if not results:
        print("  Aucun texte détecté, image copiée telle quelle.")
        img_pil.save(output_path)
        return

    print(f"  {len(results)} zone(s) de texte trouvée(s).")

    # --- Création du masque ---
    mask = build_text_mask(img_np, results, TEXT_PADDING)

    if mask.max() == 0:
        print("  Aucune zone à effacer (confiance trop faible), image copiée telle quelle.")
        img_pil.save(output_path)
        return

    # --- Inpainting LaMa ---
    print("  Inpainting en cours...")
    mask_pil = Image.fromarray(mask)
    result_pil = lama(img_pil, mask_pil)
    result_pil.save(output_path)
    print(f"  Sauvegardé : {output_path}")


def main():
    images = [
        f for f in os.listdir(INPUT_FOLDER)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ]

    if not images:
        print(f"Aucune image trouvée dans '{INPUT_FOLDER}'.")
        sys.exit(0)

    print(f"{len(images)} image(s) à traiter.\n")

    for filename in images:
        input_path = os.path.join(INPUT_FOLDER, filename)
        output_path = os.path.join(OUTPUT_FOLDER, filename)
        try:
            remove_watermark(input_path, output_path)
        except Exception as e:
            print(f"  [ERREUR] {filename} : {e}")

    print(f"\nTerminé ! Images nettoyées dans '{OUTPUT_FOLDER}'.")


if __name__ == "__main__":
    main()