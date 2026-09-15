import json
import os
import re
import time
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# ==================== CONFIGURATION ====================
SERVICE_ACCOUNT_FILE = "credentials.json"
SPREADSHEET_ID = "1TQtZiMrKfIeciuTFCCVlPQygkDtKiGYwycnrdjd-_u0"
SHEET_NAMES = ["Battles nationales", "Battles internationales"]
REQUEST_DELAY = 0.5
IMAGES_FOLDER = "server/beatbox_artists"
BEATBOXERS_JSON = "server/beatbox_artists/beatboxers.json"
# =======================================================

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
GREEN_COLOR = {"red": 0.0, "green": 0.8, "blue": 0.0}
RED_COLOR = {"red": 1.0, "green": 0.0, "blue": 0.0}

# Seuil pour considérer une cellule comme "rouge"
RED_THRESHOLD = 0.5  # red > 0.5, green < 0.5, blue < 0.5


def load_beatboxers(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_beatboxers(json_path, data):
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def title_to_filename(title):
    return title.replace(". ", "_").replace(", ", "_").replace(".", "_").replace("'", "_").replace(" ", "_").replace("-", "_").replace(":", "_")


def scan_images(folder):
    images = {}
    if not os.path.exists(folder):
        print(f"[WARN] Dossier images introuvable : {folder}")
        return images
    for filename in os.listdir(folder):
        name, ext = os.path.splitext(filename)
        if ext.lower() in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            images[name] = filename
    return images


def update_local_images(beatboxers, images_dict):
    updated = []
    for bb in beatboxers:
        title = bb.get("title", "")
        filename_base = title_to_filename(title)
        if filename_base in images_dict:
            filename_only = images_dict[filename_base]
            if bb.get("local_image") != filename_only:
                bb["local_image"] = filename_only
                updated.append(title)
    return updated


def get_beatboxers_with_images(beatboxers):
    return {bb["title"] for bb in beatboxers if bb.get("local_image")}


def normalize(name):
    return re.sub(r"\s+", " ", name.strip().lower())


def get_sheet_data(service, spreadsheet_id, sheet_name):
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{sheet_name}'"
    ).execute()
    return result.get("values", [])


def get_sheet_id(service, spreadsheet_id, sheet_name):
    meta = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    for sheet in meta["sheets"]:
        if sheet["properties"]["title"] == sheet_name:
            return sheet["properties"]["sheetId"]
    return None


def is_red_color(color):
    """Retourne True si la couleur est considérée comme rouge."""
    if not color:
        return False
    r = color.get("red", 0)
    g = color.get("green", 0)
    b = color.get("blue", 0)
    return r > RED_THRESHOLD and g < RED_THRESHOLD and b < RED_THRESHOLD


def get_sheet_data_with_colors(service, spreadsheet_id, sheet_name):
    """
    Récupère les valeurs ET les couleurs de fond de toutes les cellules.
    Retourne (values_grid, colors_grid) où chaque élément est une liste de listes.
    """
    result = service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        ranges=[f"'{sheet_name}'"],
        includeGridData=True
    ).execute()

    sheets = result.get("sheets", [])
    if not sheets:
        return [], []

    grid_data = sheets[0].get("data", [])
    if not grid_data:
        return [], []

    values_grid = []
    colors_grid = []

    for row_data in grid_data[0].get("rowData", []):
        row_values = []
        row_colors = []
        for cell in row_data.get("values", []):
            # Valeur textuelle
            val = cell.get("formattedValue", "")
            row_values.append(val)
            # Couleur de fond
            fmt = cell.get("effectiveFormat", {})
            bg = fmt.get("backgroundColor", {})
            row_colors.append(bg)
        values_grid.append(row_values)
        colors_grid.append(row_colors)

    return values_grid, colors_grid


def collect_red_names(values_grid, colors_grid):
    """Collecte tous les noms (normalisés) dont la cellule est en rouge."""
    red_names = set()
    for row_values, row_colors in zip(values_grid, colors_grid):
        for cell_value, cell_color in zip(row_values, row_colors):
            if cell_value and is_red_color(cell_color):
                red_names.add(normalize(cell_value))
    return red_names


def build_green_requests(sheet_id, data, beatboxers_with_images_normalized):
    requests = []
    for row_idx, row in enumerate(data):
        for col_idx, cell in enumerate(row):
            cell_normalized = normalize(cell)
            if cell_normalized in beatboxers_with_images_normalized:
                requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": sheet_id,
                            "startRowIndex": row_idx,
                            "endRowIndex": row_idx + 1,
                            "startColumnIndex": col_idx,
                            "endColumnIndex": col_idx + 1,
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": GREEN_COLOR
                            }
                        },
                        "fields": "userEnteredFormat.backgroundColor"
                    }
                })
    return requests


def build_red_propagation_requests(sheet_id, values_grid, red_names_normalized):
    """
    Construit les requêtes pour colorier en rouge toutes les cellules dont
    le nom (normalisé) est dans red_names_normalized.
    """
    requests = []
    for row_idx, row in enumerate(values_grid):
        for col_idx, cell_value in enumerate(row):
            if cell_value and normalize(cell_value) in red_names_normalized:
                requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": sheet_id,
                            "startRowIndex": row_idx,
                            "endRowIndex": row_idx + 1,
                            "startColumnIndex": col_idx,
                            "endColumnIndex": col_idx + 1,
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": RED_COLOR
                            }
                        },
                        "fields": "userEnteredFormat.backgroundColor"
                    }
                })
    return requests


def is_white_color(color):
    """Retourne True si la couleur est blanche (ou absente = blanc par défaut)."""
    if not color:
        return True
    r = color.get("red", 1)
    g = color.get("green", 1)
    b = color.get("blue", 1)
    # Blanc = toutes les composantes proches de 1
    return r >= 0.99 and g >= 0.99 and b >= 0.99


def count_white_cells(values_grid, colors_grid):
    """
    Retourne le nombre de cellules non coloriées (blanches) ayant du contenu,
    ainsi que la liste des noms concernés.
    """
    white_cells = []
    for row_idx, (row_values, row_colors) in enumerate(zip(values_grid, colors_grid)):
        for col_idx, (cell_value, cell_color) in enumerate(zip(row_values, row_colors)):
            if cell_value and is_white_color(cell_color):
                white_cells.append((row_idx, col_idx, cell_value))
    return white_cells


def apply_requests(service, spreadsheet_id, requests, delay=REQUEST_DELAY):
    batch_size = 500
    for i in range(0, len(requests), batch_size):
        batch = requests[i:i + batch_size]
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": batch}
        ).execute()
        time.sleep(delay)


def main():
    print("Chargement du fichier JSON...")
    beatboxers = load_beatboxers(BEATBOXERS_JSON)

    print(f"Scan des images dans '{IMAGES_FOLDER}'...")
    images_dict = scan_images(IMAGES_FOLDER)
    print(f"  {len(images_dict)} image(s) trouvée(s).")

    updated = update_local_images(beatboxers, images_dict)
    if updated:
        print(f"  {len(updated)} beatboxer(s) mis à jour : {', '.join(updated)}")
        save_beatboxers(BEATBOXERS_JSON, beatboxers)
        print("  Fichier JSON sauvegardé.")
    else:
        print("  Aucune mise à jour nécessaire dans le JSON.")

    beatboxers_with_images = get_beatboxers_with_images(beatboxers)
    beatboxers_normalized = {normalize(name) for name in beatboxers_with_images}
    print(f"  {len(beatboxers_normalized)} beatboxer(s) avec image détecté(s).")

    print("Connexion à Google Sheets...")
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)

    # ── Étape 1 : Collecter tous les noms en rouge sur toutes les feuilles ──
    print("\nCollecte des noms en rouge sur toutes les feuilles...")
    all_red_names = set()
    sheet_data_cache = {}  # { sheet_name: (values_grid, colors_grid, sheet_id) }

    for sheet_name in SHEET_NAMES:
        print(f"  Lecture de '{sheet_name}'...")
        sheet_id = get_sheet_id(service, SPREADSHEET_ID, sheet_name)
        if sheet_id is None:
            print(f"  [WARN] Feuille introuvable : {sheet_name}")
            continue

        values_grid, colors_grid = get_sheet_data_with_colors(service, SPREADSHEET_ID, sheet_name)
        sheet_data_cache[sheet_name] = (values_grid, colors_grid, sheet_id)

        red_names = collect_red_names(values_grid, colors_grid)
        print(f"    {len(red_names)} nom(s) en rouge trouvé(s) : {', '.join(sorted(red_names)) if red_names else '(aucun)'}")
        all_red_names.update(red_names)

    print(f"\n  Total noms en rouge (toutes feuilles confondues) : {len(all_red_names)}")

    # ── Étape 2 : Appliquer vert (images) et rouge (propagation) sur chaque feuille ──
    for sheet_name in SHEET_NAMES:
        if sheet_name not in sheet_data_cache:
            continue

        values_grid, colors_grid, sheet_id = sheet_data_cache[sheet_name]
        # Reconvertir values_grid en format liste plate pour build_green_requests
        flat_values = [row for row in values_grid]

        print(f"\nTraitement de la feuille '{sheet_name}'...")

        # Coloration verte (beatboxers avec image)
        green_requests = build_green_requests(sheet_id, flat_values, beatboxers_normalized)
        print(f"  {len(green_requests)} cellule(s) à colorier en vert.")

        # Propagation rouge
        red_requests = build_red_propagation_requests(sheet_id, values_grid, all_red_names)
        print(f"  {len(red_requests)} cellule(s) à colorier en rouge (propagation).")

        all_requests = green_requests + red_requests
        if all_requests:
            apply_requests(service, SPREADSHEET_ID, all_requests)
            print(f"  Mise en couleur appliquée.")

        time.sleep(REQUEST_DELAY)

    # ── Étape 3 : Rapport des cases blanches (non coloriées) avec contenu ──
    print("\n" + "=" * 60)
    print("RAPPORT DES CASES NON COLORIÉES (blanches avec contenu)")
    print("=" * 60)

    total_white = 0
    all_white_names = set()

    for sheet_name in SHEET_NAMES:
        if sheet_name not in sheet_data_cache:
            continue

        values_grid, colors_grid, sheet_id = sheet_data_cache[sheet_name]
        white_cells = count_white_cells(values_grid, colors_grid)
        count = len(white_cells)
        total_white += count
        names = sorted({cell[2] for cell in white_cells})
        all_white_names.update(names)

        print(f"\n  '{sheet_name}' : {count} case(s) blanche(s)")
        if names:
            for name in names:
                print(f"    - {name}")

    print(f"\n  TOTAL toutes feuilles : {total_white} case(s) blanche(s)")
    unique_white = sorted(all_white_names)
    print(f"  Noms uniques sans couleur : {len(unique_white)}")
    print("=" * 60)

    print("\nTerminé !")


if __name__ == "__main__":
    main()