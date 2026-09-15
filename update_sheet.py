import time
import re
import requests
from bs4 import BeautifulSoup
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import unicodedata

# ==================== CONFIGURATION ====================
SERVICE_ACCOUNT_FILE = "credentials.json"
SPREADSHEET_ID = "1TQtZiMrKfIeciuTFCCVlPQygkDtKiGYwycnrdjd-_u0"
SHEET_NAMES = ["Battles nationales", "Battles internationales"]

REQUEST_DELAY = 0.5
# =======================================================

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

BATTLE_RESULT_KEYWORDS = [
    "vote", "win", "lose", "place", "final", "champion",
    "score", "point", "draw", "bye", "tbd", "???",
]

session = requests.Session()
session.headers.update({"User-Agent": "BeatboxWikiScraper/1.0"})

WIKI_BASE = "https://beatbox.fandom.com"


# ==================== NETTOYAGE DES NOMS ====================

def clean_name(raw_text):
    """
    Nettoie le texte brut d'une cellule pour n'en extraire que le nom du beatboxer.
    """
    name = raw_text.strip()

    # Supprime les annotations entre crochets : "Killer[*]" -> "Killer"
    name = re.sub(r'\[.*?\]', '', name).strip()

    # Coupe au premier "vs" SANS espace obligatoire : "JulardvsDMN" -> "Julard"
    # Le \b est retiré pour capturer "xxxvsyyy" collé
    name = re.split(r'\s*vs\.?\s*', name, flags=re.IGNORECASE)[0].strip()

    # Coupe au slash : "Wawad/Wawad" -> "Wawad"
    name = name.split('/')[0].strip()

    # Coupe à la première parenthèse : "Lyre Lyre(Fatty K)" -> "Lyre Lyre"
    name = re.split(r'\s*\(', name)[0].strip()

    # Coupe au "&" qui indiquerait un duo sans parenthèses : "BMG & Julard" -> "BMG"
    # Seulement si le "&" est précédé d'un nom court (équipe non intentionnelle)
    name = re.split(r'\s+&\s+', name)[0].strip()

    # Supprime les caractères parasites en fin de nom
    name = re.sub(r'[\s\-_]+$', '', name)

    return name if len(name) >= 2 else None

def is_valid_name(name):
    """Vérifie qu'un nom nettoyé est valide (pas un résultat de battle)."""
    if not name or len(name) < 2:
        return False
    name_lower = name.lower()
    if any(kw in name_lower for kw in BATTLE_RESULT_KEYWORDS):
        return False
    # Exclut les cellules qui ne contiennent que des chiffres ou symboles
    if re.match(r'^[\d\s\-/]+$', name):
        return False
    return True


# ==================== SCRAPING ====================

def fetch_page(url):
    time.sleep(REQUEST_DELAY)
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        print(f"  ⚠ Erreur fetch {url}: {e}")
        return None


def get_all_tables_after_header(content, header_text):
    tables = []
    found = False
    for el in content.find_all(['h2', 'h3', 'table']):
        if el.name in ['h2', 'h3']:
            if header_text.lower() in el.get_text().lower():
                found = True
                continue
            elif found and el.name == 'h2':
                break
        elif el.name == 'table' and found:
            tables.append(el)
    return tables


def extract_battlers_from_results_tables(tables):
    """
    Extrait les noms uniques des beatboxers depuis les tableaux Results.
    Pour chaque <td> avec un drapeau Category:Pays, nettoie le texte
    pour ne garder que le nom principal (sans "vs ...", sans "(équipe)", etc.)
    """
    names = set()
    for table in tables:
        for td in table.find_all('td'):
            has_flag = td.find('a', href=lambda h: h and '/wiki/Category:' in (h or ''))
            if not has_flag:
                continue

            raw = td.get_text(strip=True)
            name = clean_name(raw)

            if name and is_valid_name(name):
                names.add(name)

    return names


def get_edition_pages(event_name):
    slug = event_name.replace(" ", "_")
    editions = []
    seen = set()

    # Stratégie 1 : page principale
    main_url = f"{WIKI_BASE}/wiki/{slug}"
    soup = fetch_page(main_url)
    if soup and soup.find("div", class_="mw-parser-output"):
        content = soup.find("div", class_="mw-parser-output")
        for a in content.find_all("a", href=True):
            href = a["href"]
            match = (
                re.search(rf'/wiki/{re.escape(slug)}_(\d{{4}})', href) or
                re.search(rf'/wiki/(\d{{4}})_{re.escape(slug)}', href)
            )
            if match:
                year = match.group(1)
                full_url = WIKI_BASE + href if href.startswith("/wiki/") else href
                if full_url not in seen:
                    seen.add(full_url)
                    editions.append((year, full_url))

    # Stratégie 2 : API MediaWiki
    if not editions:
        search_url = f"{WIKI_BASE}/api/v1/Search/List?query={requests.utils.quote(event_name)}&limit=50&namespaces=0"
        try:
            time.sleep(REQUEST_DELAY)
            resp = session.get(search_url, timeout=15)
            data = resp.json()
            for item in data.get("items", []):
                title = item.get("title", "")
                match = (
                    re.search(rf'^{re.escape(event_name)}\s*(\d{{4}})$', title, re.I) or
                    re.search(rf'^(\d{{4}})\s*{re.escape(event_name)}$', title, re.I)
                )
                if match:
                    year = match.group(1)
                    url_slug = title.replace(" ", "_")
                    full_url = f"{WIKI_BASE}/wiki/{url_slug}"
                    if full_url not in seen:
                        seen.add(full_url)
                        editions.append((year, full_url))
        except Exception as e:
            print(f"  ⚠ Erreur API search : {e}")

    # Stratégie 3 : force brute
    if not editions:
        for year in range(2010, 2026):
            for url in [
                f"{WIKI_BASE}/wiki/{slug}_{year}",
                f"{WIKI_BASE}/wiki/{year}_{slug}",
            ]:
                try:
                    time.sleep(REQUEST_DELAY)
                    resp = session.get(url, timeout=10)
                    if resp.status_code == 200:
                        if url not in seen:
                            seen.add(url)
                            editions.append((str(year), url))
                except Exception:
                    pass

    editions.sort(key=lambda x: x[0])
    return editions


def scrape_battlers_for_event(event_name):
    editions = get_edition_pages(event_name)
    if not editions:
        return set()

    print(f"  → {len(editions)} éditions : {[y for y, _ in editions]}")
    all_battlers = set()

    for year, url in editions:
        print(f"    [{year}] {url.split('/wiki/')[-1]}", end=" ", flush=True)
        soup = fetch_page(url)
        if not soup:
            print("⚠ Erreur")
            continue

        content = soup.find("div", class_="mw-parser-output")
        if not content:
            print("⚠ Pas de contenu")
            continue

        result_tables = get_all_tables_after_header(content, "Results")
        if not result_tables:
            print("⚠ Pas de section Results")
            continue

        battlers = extract_battlers_from_results_tables(result_tables)
        all_battlers.update(battlers)
        print(f"→ {len(battlers)} battlers")

    return all_battlers


# ==================== GOOGLE SHEETS ====================

def get_sheet_data(service, spreadsheet_id, sheet_name):
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=sheet_name
    ).execute()
    return result.get("values", [])


def index_to_col_letter(index):
    result = ""
    index += 1
    while index > 0:
        index -= 1
        result = chr(65 + index % 26) + result
        index //= 26
    return result


def get_all_events_from_sheets(service, spreadsheet_id, sheet_names):
    events = {}
    for sheet_name in sheet_names:
        rows = get_sheet_data(service, spreadsheet_id, sheet_name)
        if not rows:
            continue
        headers = rows[0]
        for col_idx, header in enumerate(headers):
            event_name = header.strip()
            if not event_name:
                continue
            existing = set()
            last_filled_row = 0
            for row_idx in range(1, len(rows)):
                if col_idx < len(rows[row_idx]):
                    val = rows[row_idx][col_idx].strip()
                    if val:
                        existing.add(val)
                        last_filled_row = row_idx
            events[event_name] = {
                "sheet": sheet_name,
                "col_idx": col_idx,
                "existing": existing,
                "last_filled_row": last_filled_row,
            }
    return events


import unicodedata

def normalize_for_comparison(text):
    text = text.lower()
    # Décompose les caractères accentués puis supprime les diacritiques
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    # Supprime les caractères spéciaux courants
    text = re.sub(r"[''´`.,*\-_!?@#$%^&+=|<>~]", '', text)
    # Supprime TOUS les espaces (pour matcher "Faya Braz" == "fayabraz")
    text = re.sub(r'\s+', '', text)
    return text

def clean_name(raw_text):
    """
    Nettoie le texte brut d'une cellule pour n'en extraire que le nom du beatboxer.
    """
    name = raw_text.strip()

    # Supprime les numérotations en début : "1. Roxor", "2. Flex" -> "Roxor", "Flex"
    name = re.sub(r'^\d+[\.\)]\s*', '', name).strip()

    # Supprime les annotations entre crochets : "Killer[*]" -> "Killer"
    name = re.sub(r'\[.*?\]', '', name).strip()

    # Supprime les astérisques et autres symboles isolés
    name = re.sub(r'\*+', '', name).strip()

    # Coupe au premier "vs" sans espace obligatoire : "JulardvsDMN" -> "Julard"
    name = re.split(r'\s*vs\.?\s*', name, flags=re.IGNORECASE)[0].strip()

    # Coupe au slash : "Wawad/Wawad" -> "Wawad"
    name = name.split('/')[0].strip()

    # Coupe à la première parenthèse : "Lyre Lyre(Fatty K)" -> "Lyre Lyre"
    name = re.split(r'\s*\(', name)[0].strip()

    # Coupe au "&" qui indiquerait un duo : "BMG & Julard" -> "BMG"
    name = re.split(r'\s+&\s+', name)[0].strip()

    # Supprime les caractères parasites en fin de nom (tirets, espaces, points)
    name = re.sub(r'[\s\-_\.]+$', '', name).strip()

    return name if len(name) >= 2 else None


def update_column(service, spreadsheet_id, event_name, event_info, battlers):
    # Comparaison normalisée : insensible à la casse ET aux accents/caractères spéciaux
    existing_normalized = {normalize_for_comparison(v): v for v in event_info["existing"]}

    to_add = []
    for name in sorted(battlers):
        if normalize_for_comparison(name) not in existing_normalized:
            to_add.append(name)

    if not to_add:
        print(f"  ✓ Déjà à jour ({len(event_info['existing'])} entrées)")
        return 0

    col_letter = index_to_col_letter(event_info["col_idx"])
    start_row = event_info["last_filled_row"] + 2
    end_row = start_row + len(to_add) - 1
    range_notation = f"{event_info['sheet']}!{col_letter}{start_row}:{col_letter}{end_row}"

    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=range_notation,
        valueInputOption="RAW",
        body={"values": [[name] for name in to_add]}
    ).execute()

    print(f"  ✓ +{len(to_add)} ajoutés (col {col_letter}, lignes {start_row}→{end_row})")
    for name in to_add:
        print(f"      + {name}")
    return len(to_add)


# ==================== MAIN ====================

def main():
    print("Connexion à Google Sheets...")
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)

    print("Lecture des headers...\n")
    all_events = get_all_events_from_sheets(service, SPREADSHEET_ID, SHEET_NAMES)

    total_events = len(all_events)
    print(f"  → {total_events} événements trouvés au total\n")
    for sheet in SHEET_NAMES:
        cols = [e for e, v in all_events.items() if v["sheet"] == sheet]
        print(f"  [{sheet}] ({len(cols)}) : {', '.join(cols[:5])}{'...' if len(cols) > 5 else ''}")

    print()

    total_added = 0
    skipped = 0

    for i, (event_name, event_info) in enumerate(all_events.items(), start=1):
        pct = i / total_events
        bar = "█" * int(pct * 20) + "░" * (20 - int(pct * 20))
        print(f"\n[{bar}] {i}/{total_events} — {event_name} ({event_info['sheet']})")

        battlers = scrape_battlers_for_event(event_name)

        if not battlers:
            print(f"  ⚠ Aucun battler trouvé, colonne ignorée")
            skipped += 1
            continue

        print(f"  {len(battlers)} battlers scrapés au total")
        added = update_column(service, SPREADSHEET_ID, event_name, event_info, battlers)
        total_added += added

    print(f"\n{'=' * 55}")
    print(f"  ✓ Terminé !")
    print(f"  Événements traités : {total_events - skipped}/{total_events}")
    print(f"  Événements ignorés : {skipped} (aucune page wiki trouvée)")
    print(f"  Beatboxers ajoutés : {total_added}")
    print(f"{'=' * 55}")


if __name__ == "__main__":
    main()