import json
import time
import re
import requests
from bs4 import BeautifulSoup
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# ==================== CONFIGURATION ====================
SERVICE_ACCOUNT_FILE = "credentials.json"
SPREADSHEET_ID = "1TQtZiMrKfIeciuTFCCVlPQygkDtKiGYwycnrdjd-_u0"
SHEET_NAMES = ["Battles nationales", "Battles internationales"]
OUTPUT_FILE = "beatboxers.json"

WIKI_BASE = "https://beatbox.fandom.com"
CATEGORY_URLS = [
    f"{WIKI_BASE}/wiki/Category:International",
    f"{WIKI_BASE}/wiki/Category:National",
]

REQUEST_DELAY = 0.5
# =======================================================

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# Fallback : emojis drapeaux (utilisés sur certaines pages)
FLAG_TO_NATIONALITY = {
    "🇫🇷": "France", "🇺🇸": "United States", "🇩🇪": "Germany",
    "🇬🇧": "United Kingdom", "🇯🇵": "Japan", "🇰🇷": "South Korea",
    "🇨🇳": "China", "🇧🇷": "Brazil", "🇦🇺": "Australia",
    "🇨🇦": "Canada", "🇳🇱": "Netherlands", "🇧🇪": "Belgium",
    "🇨🇭": "Switzerland", "🇦🇹": "Austria", "🇸🇪": "Sweden",
    "🇳🇴": "Norway", "🇩🇰": "Denmark", "🇫🇮": "Finland",
    "🇮🇹": "Italy", "🇪🇸": "Spain", "🇵🇹": "Portugal",
    "🇵🇱": "Poland", "🇷🇺": "Russia", "🇺🇦": "Ukraine",
    "🇷🇴": "Romania", "🇨🇿": "Czech Republic", "🇸🇰": "Slovakia",
    "🇭🇺": "Hungary", "🇭🇷": "Croatia", "🇸🇮": "Slovenia",
    "🇷🇸": "Serbia", "🇧🇬": "Bulgaria", "🇬🇷": "Greece",
    "🇹🇷": "Turkey", "🇮🇱": "Israel", "🇸🇦": "Saudi Arabia",
    "🇦🇪": "UAE", "🇮🇳": "India", "🇵🇭": "Philippines",
    "🇹🇭": "Thailand", "🇻🇳": "Vietnam", "🇲🇾": "Malaysia",
    "🇸🇬": "Singapore", "🇮🇩": "Indonesia", "🇳🇿": "New Zealand",
    "🇿🇦": "South Africa", "🇲🇦": "Morocco", "🇩🇿": "Algeria",
    "🇹🇳": "Tunisia", "🇪🇬": "Egypt", "🇲🇽": "Mexico",
    "🇦🇷": "Argentina", "🇨🇱": "Chile", "🇨🇴": "Colombia",
    "🇵🇪": "Peru", "🇻🇪": "Venezuela", "🇨🇺": "Cuba",
    "🇭🇰": "Hong Kong", "🇹🇼": "Taiwan", "🇲🇨": "Monaco",
    "🏴󠁧󠁢󠁳󠁣󠁴󠁿": "Scotland", "🏴󠁧󠁢󠁷󠁬󠁳󠁿": "Wales",
}

# Méthode principale : lien Category:Pays dans les cellules du wiki
CATEGORY_TO_NATIONALITY = {
    "Category:Armenia": "Armenia",
    "Category:France": "France",
    "Category:United_States": "United States",
    "Category:Germany": "Germany",
    "Category:United_Kingdom": "United Kingdom",
    "Category:Japan": "Japan",
    "Category:South_Korea": "South Korea",
    "Category:China": "China",
    "Category:Brazil": "Brazil",
    "Category:Australia": "Australia",
    "Category:Canada": "Canada",
    "Category:Netherlands": "Netherlands",
    "Category:Belgium": "Belgium",
    "Category:Switzerland": "Switzerland",
    "Category:Austria": "Austria",
    "Category:Sweden": "Sweden",
    "Category:Norway": "Norway",
    "Category:Denmark": "Denmark",
    "Category:Finland": "Finland",
    "Category:Italy": "Italy",
    "Category:Spain": "Spain",
    "Category:Portugal": "Portugal",
    "Category:Poland": "Poland",
    "Category:Russia": "Russia",
    "Category:Ukraine": "Ukraine",
    "Category:Romania": "Romania",
    "Category:Czech_Republic": "Czech Republic",
    "Category:Slovakia": "Slovakia",
    "Category:Hungary": "Hungary",
    "Category:Croatia": "Croatia",
    "Category:Slovenia": "Slovenia",
    "Category:Serbia": "Serbia",
    "Category:Bulgaria": "Bulgaria",
    "Category:Greece": "Greece",
    "Category:Turkey": "Turkey",
    "Category:Israel": "Israel",
    "Category:Saudi_Arabia": "Saudi Arabia",
    "Category:UAE": "UAE",
    "Category:India": "India",
    "Category:Philippines": "Philippines",
    "Category:Thailand": "Thailand",
    "Category:Vietnam": "Vietnam",
    "Category:Malaysia": "Malaysia",
    "Category:Singapore": "Singapore",
    "Category:Indonesia": "Indonesia",
    "Category:New_Zealand": "New Zealand",
    "Category:South_Africa": "South Africa",
    "Category:Morocco": "Morocco",
    "Category:Algeria": "Algeria",
    "Category:Tunisia": "Tunisia",
    "Category:Egypt": "Egypt",
    "Category:Mexico": "Mexico",
    "Category:Argentina": "Argentina",
    "Category:Chile": "Chile",
    "Category:Colombia": "Colombia",
    "Category:Peru": "Peru",
    "Category:Venezuela": "Venezuela",
    "Category:Cuba": "Cuba",
    "Category:Hong_Kong": "Hong Kong",
    "Category:Taiwan": "Taiwan",
    "Category:Monaco": "Monaco",
    "Category:Scotland": "Scotland",
    "Category:Wales": "Wales",
    "Category:Lithuania": "Lithuania",
    "Category:Latvia": "Latvia",
    "Category:Estonia": "Estonia",
    "Category:Belarus": "Belarus",
    "Category:Kazakhstan": "Kazakhstan",
    "Category:Georgia": "Georgia",
    "Category:Azerbaijan": "Azerbaijan",
    "Category:Uzbekistan": "Uzbekistan",
    "Category:Iran": "Iran",
    "Category:Iraq": "Iraq",
    "Category:Pakistan": "Pakistan",
    "Category:Bangladesh": "Bangladesh",
    "Category:Sri_Lanka": "Sri Lanka",
    "Category:Nepal": "Nepal",
    "Category:Myanmar": "Myanmar",
    "Category:Cambodia": "Cambodia",
    "Category:Nigeria": "Nigeria",
    "Category:Kenya": "Kenya",
    "Category:Ghana": "Ghana",
    "Category:Cameroon": "Cameroon",
    "Category:Senegal": "Senegal",
    "Category:Puerto_Rico": "Puerto Rico",
    "Category:Dominican_Republic": "Dominican Republic",
    "Category:Ecuador": "Ecuador",
    "Category:Bolivia": "Bolivia",
    "Category:Uruguay": "Uruguay",
    "Category:Paraguay": "Paraguay",
    "Category:Iceland": "Iceland",
    "Category:Ireland": "Ireland",
    "Category:Luxembourg": "Luxembourg",
    "Category:Malta": "Malta",
    "Category:Cyprus": "Cyprus",
    "Category:Albania": "Albania",
    "Category:North_Macedonia": "North Macedonia",
    "Category:Bosnia_and_Herzegovina": "Bosnia and Herzegovina",
    "Category:Montenegro": "Montenegro",
    "Category:Moldova": "Moldova",
}

session = requests.Session()
session.headers.update({"User-Agent": "BeatboxWikiScraper/1.0"})


def fetch_page(url):
    time.sleep(REQUEST_DELAY)
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        print(f"\n    ⚠ Erreur fetch {url}: {e}")
        return None


def extract_nationality_from_text(text):
    """Fallback : cherche un emoji drapeau dans le texte."""
    for flag, country in FLAG_TO_NATIONALITY.items():
        if flag in text:
            return country
    return None


def extract_nationality_from_category_link(tag):
    """
    Méthode principale : cherche un lien vers Category:Pays dans le tag.
    Ex: href="https://beatbox.fandom.com/wiki/Category:Armenia" -> "Armenia"
    """
    for a in tag.find_all("a", href=True):
        href = a["href"]
        if "/wiki/Category:" in href:
            cat_key = href.split("/wiki/")[-1]  # "Category:Armenia"
            nat = CATEGORY_TO_NATIONALITY.get(cat_key)
            if nat:
                return nat
            # Fallback : extrait le nom brut depuis l'URL
            country_raw = cat_key.replace("Category:", "").replace("_", " ")
            if country_raw:
                return country_raw
    return None


def extract_nationality_from_soup(soup):
    """Cherche la nationalité sur une page dédiée beatboxer (infobox)."""
    for data in soup.find_all("div", class_="pi-data"):
        label = data.find("h3", class_="pi-data-label")
        value = data.find("div", class_="pi-data-value")
        if label and value:
            label_text = label.get_text().lower()
            if any(k in label_text for k in ["nationalit", "country", "origin", "from"]):
                nat = extract_nationality_from_category_link(value)
                if nat:
                    return nat
                nat = extract_nationality_from_text(value.get_text())
                if nat:
                    return nat
                return value.get_text(strip=True)

    infobox = soup.find("table", class_=re.compile("infobox|portable-infobox", re.I))
    if infobox:
        nat = extract_nationality_from_category_link(infobox)
        if nat:
            return nat
        nat = extract_nationality_from_text(infobox.get_text())
        if nat:
            return nat

    content = soup.find("div", class_=re.compile("mw-parser-output"))
    if content:
        nat = extract_nationality_from_text(content.get_text())
        if nat:
            return nat

    return None


def get_all_event_pages_from_category(cat_url):
    pages = []
    url = cat_url
    while url:
        soup = fetch_page(url)
        if not soup:
            break
        content = soup.find("div", class_="category-page__members")
        if content:
            for a in content.find_all("a", class_="category-page__member-link"):
                href = a.get("href", "")
                if href and "/wiki/" in href and "Category:" not in href:
                    pages.append(href if href.startswith("http") else WIKI_BASE + href)
        next_btn = soup.find("a", class_="category-page__pagination-next")
        if next_btn:
            next_href = next_btn["href"]
            url = next_href if next_href.startswith("http") else WIKI_BASE + next_href
        else:
            url = None
    return pages


def get_subpages_from_event_page(event_url, index=None, total=None):
    slug = event_url.split("/wiki/")[-1]
    prefix = f"  [{index}/{total}]" if index and total else "  "
    print(f"{prefix} {slug[:60]:<60}", end=" ", flush=True)

    soup = fetch_page(event_url)
    if not soup:
        print("⚠ Erreur")
        return []

    subpages = []
    content = soup.find("div", class_="mw-parser-output")
    if not content:
        print("⚠ Pas de contenu")
        return []

    for a in content.find_all("a", href=True):
        href = a["href"]
        if f"/wiki/{slug}_" in href or re.search(r"/wiki/.+_\d{4}", href):
            full = WIKI_BASE + href if href.startswith("/wiki/") else href
            if full not in subpages and "Category:" not in full:
                subpages.append(full)

    if not subpages:
        subpages = [event_url]

    print(f"→ {len(subpages)} édition(s)")
    return subpages


def extract_beatboxers_from_page(url):
    """
    Extrait {nom: nationalité} depuis une page d'édition.
    Méthode principale : <td> avec lien Category:Pays + texte = nom.
    Fallback : liens internes vers pages beatboxers.
    """
    soup = fetch_page(url)
    if not soup:
        return {}

    results = {}
    content = soup.find("div", class_="mw-parser-output")
    if not content:
        return results

    # Méthode principale : cellules tableau avec drapeau (Category:Pays) + nom en texte brut
    for td in content.find_all("td"):
        nat = extract_nationality_from_category_link(td)
        if nat is None:
            continue
        name = td.get_text(separator=" ", strip=True)
        if not name or len(name) < 2:
            continue
        if name not in results:
            results[name] = nat

    # Fallback : pages qui utilisent des liens internes vers beatboxers
    if not results:
        for a in content.find_all("a", href=True):
            href = a["href"]
            name = a.get_text(strip=True)
            if (
                href.startswith("/wiki/")
                and "Category:" not in href
                and "File:" not in href
                and "Template:" not in href
                and name and len(name) > 1
                and not name.startswith("http")
            ):
                nat = (
                    extract_nationality_from_category_link(a.parent)
                    or extract_nationality_from_text(a.parent.get_text() if a.parent else "")
                )
                if name not in results:
                    results[name] = nat

    return results


def build_nationality_database(beatboxer_names):
    print("\n=== Scraping du Beatbox Wiki ===")

    # Étape 1 : collecter toutes les pages d'événements
    all_event_pages = []
    for cat_url in CATEGORY_URLS:
        print(f"\nScan catégorie : {cat_url}")
        pages = get_all_event_pages_from_category(cat_url)
        print(f"  → {len(pages)} pages trouvées")
        all_event_pages.extend(pages)

    # Étape 2 : récupérer les éditions de chaque événement
    total_events = len(all_event_pages)
    all_edition_pages = []
    print(f"\nRécupération des éditions pour {total_events} événements...\n")
    for i, ep in enumerate(all_event_pages, start=1):
        subs = get_subpages_from_event_page(ep, index=i, total=total_events)
        all_edition_pages.extend(subs)

    all_edition_pages = list(set(all_edition_pages))
    print(f"\n✓ {len(all_edition_pages)} pages d'édition à scanner au total")

    # Étape 3 : scanner toutes les éditions
    wiki_db = {}
    total_editions = len(all_edition_pages)
    print(f"\nScan des {total_editions} pages d'édition...\n")
    for i, page_url in enumerate(all_edition_pages, start=1):
        slug = page_url.split("/wiki/")[-1]
        pct = i / total_editions
        bar_filled = int(pct * 30)
        bar = "█" * bar_filled + "░" * (30 - bar_filled)
        print(f"\r  [{bar}] {i}/{total_editions} ({pct*100:.1f}%) — {slug[:40]:<40}", end="", flush=True)

        found = extract_beatboxers_from_page(page_url)
        for k, v in found.items():
            if k not in wiki_db or (wiki_db[k] is None and v):
                wiki_db[k] = v

    print(f"\n✓ Scan terminé — {len(wiki_db)} beatboxers référencés au total")

    # Étape 4 : pages dédiées pour les beatboxers encore sans nationalité
    missing = [n for n in beatboxer_names if not wiki_db.get(n)]
    total_missing = len(missing)
    print(f"\nRecherche de pages dédiées pour {total_missing} beatboxers sans nationalité...\n")
    found_count = 0
    for i, name in enumerate(missing, start=1):
        slug = name.replace(" ", "_")
        page_url = f"{WIKI_BASE}/wiki/{slug}"
        pct = i / total_missing
        bar_filled = int(pct * 30)
        bar = "█" * bar_filled + "░" * (30 - bar_filled)
        print(f"\r  [{bar}] {i}/{total_missing} ({pct*100:.1f}%) — {name:<40}", end="", flush=True)

        soup = fetch_page(page_url)
        if soup and soup.find("div", class_="mw-parser-output"):
            nat = extract_nationality_from_soup(soup)
            if nat:
                wiki_db[name] = nat
                found_count += 1
                print(f"\n    ✓ {name} → {nat}")

    print(f"\n✓ Recherche individuelle terminée — {found_count} nationalités supplémentaires trouvées")
    return wiki_db


# ==================== GOOGLE SHEETS ====================

def get_sheet_data(service, spreadsheet_id, sheet_name):
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=sheet_name
    ).execute()
    return result.get("values", [])


def parse_beatboxers(sheets_data):
    beatboxers = {}
    for rows in sheets_data:
        if not rows:
            continue
        events = rows[0]
        for row_index in range(1, len(rows)):
            row = rows[row_index]
            for col_index, cell in enumerate(row):
                name = cell.strip()
                if not name or col_index >= len(events):
                    continue
                event = events[col_index].strip()
                if not event:
                    continue
                if name not in beatboxers:
                    beatboxers[name] = set()
                beatboxers[name].add(event)
    return beatboxers


def build_json(beatboxers, nationality_db):
    result = []
    for name, events in sorted(beatboxers.items()):
        result.append({
            "title": name,
            "nationality": nationality_db.get(name) or "",
            "local_image": "",
            "achievements": [{"event": e} for e in sorted(events)]
        })
    return result


# ==================== MAIN ====================

def main():
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)

    print("Récupération des données Google Sheets...")
    sheets_data = []
    for sheet_name in SHEET_NAMES:
        data = get_sheet_data(service, SPREADSHEET_ID, sheet_name)
        print(f"  ✓ '{sheet_name}' : {len(data)} lignes, {len(data[0]) if data else 0} colonnes")
        sheets_data.append(data)

    beatboxers = parse_beatboxers(sheets_data)
    beatboxer_names = list(beatboxers.keys())
    print(f"\n{len(beatboxer_names)} beatboxers trouvés dans le Google Sheet.")

    nationality_db = build_nationality_database(beatboxer_names)

    found = sum(1 for n in beatboxer_names if nationality_db.get(n))
    print(f"\n{'='*50}")
    print(f"✓ Nationalités trouvées : {found}/{len(beatboxer_names)}")
    not_found = [n for n in beatboxer_names if not nationality_db.get(n)]
    if not_found:
        print(f"  Beatboxers sans nationalité ({len(not_found)}) :")
        for name in not_found:
            print(f"    - {name}")

    output = build_json(beatboxers, nationality_db)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Fichier généré : {OUTPUT_FILE}")


if __name__ == "__main__":
    main()