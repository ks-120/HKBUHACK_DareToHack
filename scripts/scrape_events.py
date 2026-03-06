"""
HKBU SA Events Scraper
======================
Scrapes upcoming events from https://sa.hkbu.edu.hk and writes them to Firestore.

Setup:
  1. Go to Firebase Console → Project Settings → Service Accounts → Generate new private key
  2. Save the downloaded JSON as:  scripts/serviceAccountKey.json
  3. Run:  ../.venv/bin/python scrape_events.py

Requirements (already in ../.venv):
  playwright, beautifulsoup4, lxml, firebase-admin
"""

import json
import re
import sys
import os
from datetime import datetime
from urllib.parse import urljoin, quote

# ── Playwright ────────────────────────────────────────────────────────────────
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("playwright not found — run: pip install playwright && playwright install chromium")

# ── BeautifulSoup ─────────────────────────────────────────────────────────────
try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("beautifulsoup4 not found — run: pip install beautifulsoup4 lxml")

# ── Firebase Admin ────────────────────────────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    sys.exit("firebase-admin not found — run: pip install firebase-admin")

# ─────────────────────────────────────────────────────────────────────────────
BASE_URL   = "https://sa.hkbu.edu.hk"
LIST_URL   = (
    "https://sa.hkbu.edu.hk/content/sa/en/live/live_events.html"
    "?pageSize=100&page=0"
)
SA_DOMAIN  = "https://sa.hkbu.edu.hk"
SERVICE_KEY = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")

EMOJI_MAP = {
    "sports":        "🏃",
    "wellness":      "🧘",
    "music":         "🎵",
    "art":           "🎨",
    "culture":       "🎭",
    "drama":         "🎭",
    "theatre":       "🎭",
    "film":          "🎬",
    "gaming":        "🎮",
    "tech":          "💻",
    "coding":        "💻",
    "hack":          "💻",
    "language":      "💬",
    "food":          "🍜",
    "photography":   "📷",
    "hike":          "🥾",
    "hiking":        "🥾",
    "study":         "📚",
    "workshop":      "🛠️",
    "orientation":   "🎓",
    "open day":      "🎓",
    "fair":          "🎪",
    "exhibition":    "🖼️",
    "concert":       "🎶",
    "talk":          "🗣️",
    "seminar":       "🗣️",
    "volunteer":     "🤝",
    "charity":       "❤️",
    "trip":          "✈️",
    "exchange":      "🌏",
}

def pick_emoji(title: str, category: str) -> str:
    text = (title + " " + category).lower()
    for kw, em in EMOJI_MAP.items():
        if kw in text:
            return em
    return "🎉"

# ─────────────────────────────────────────────────────────────────────────────
def fetch_html(url: str, wait_ms: int = 4000) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, timeout=30_000)
        # Wait for images to lazy-load by scrolling to bottom
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(wait_ms)
        html = page.content()
        browser.close()
    return html

def sanitise_image_url(src: str) -> str:
    """
    - Reject base64 / data URIs (lazy-load placeholders)
    - URL-encode spaces and special chars in the path
    """
    if not src or src.startswith("data:"):
        return ""
    # Make absolute
    if not src.startswith("http"):
        src = urljoin(SA_DOMAIN, src)
    # Encode spaces and non-ASCII in the path portion only
    parts = src.split("?", 1)
    path  = quote(parts[0], safe=":/%#=&+")
    return path + ("?" + parts[1] if len(parts) > 1 else "")

def parse_date_str(raw: str) -> str:
    """
    Convert the site's date format 'DD.MM.YYYY' or 'MMM DD, YYYY' into
    a normalised 'Mon DD, YYYY' string that matches the existing app format.
    """
    raw = raw.strip()
    # e.g. "06.03.2026"
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", raw)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        dt = datetime(year, month, day)
        return dt.strftime("%b %d, %Y")
    # already a nice format
    return raw

def scrape_event_detail(url: str) -> dict:
    """Return {time, venue, description} from an event detail page."""
    result = {"time": "", "venue": "", "description": ""}
    try:
        html = fetch_html(url, wait_ms=3000)
        soup = BeautifulSoup(html, "lxml")

        detail = soup.find(class_="eventdetail")
        if not detail:
            return result

        # Key–value pairs are stored as alternating <p class="tel-row"> / <p class="tel-text">
        rows  = [p.get_text(strip=True) for p in detail.find_all("p", class_="tel-row")]
        texts = [p.get_text(strip=True) for p in detail.find_all("p", class_="tel-text")]
        kv = {r.rstrip(":").upper(): t for r, t in zip(rows, texts)}

        result["time"]  = kv.get("TIME", "")
        result["venue"] = kv.get("VENUE", "")

        # Build a human-readable description from the remaining fields
        skip = {"TIME", "VENUE"}
        desc_parts = [f"{k}: {v}" for k, v in kv.items() if k not in skip and v]
        result["description"] = "  |  ".join(desc_parts)

    except Exception as e:
        print(f"    ⚠  Could not fetch detail page {url}: {e}")
    return result

# ─────────────────────────────────────────────────────────────────────────────
def scrape_events() -> list[dict]:
    print(f"🌐  Fetching event listing …  ({LIST_URL})")
    html = fetch_html(LIST_URL, wait_ms=5000)
    soup = BeautifulSoup(html, "lxml")

    cards = soup.find_all(class_="content-filtering__item")
    print(f"✅  Found {len(cards)} event card(s)")

    events = []
    for card in cards:
        # ── Link & detail URL ──────────────────────────────────────────────
        link_tag = card.find_parent("a", class_="content-filtering__item-link") or \
                   card.find("a", class_="content-filtering__item-link")
        detail_url = ""
        if link_tag and link_tag.get("href"):
            href = link_tag["href"]
            detail_url = href if href.startswith("http") else urljoin(SA_DOMAIN, href)

        # ── Title ──────────────────────────────────────────────────────────
        title_tag = card.find(class_="content-filtering__item-content-title")
        title = title_tag.get_text(strip=True) if title_tag else "Untitled"

        # ── Date ───────────────────────────────────────────────────────────
        date_tag = card.find(class_="content-filtering__item-content-date")
        raw_date = date_tag.get_text(strip=True) if date_tag else ""
        date_str = parse_date_str(raw_date)

        # ── Category ───────────────────────────────────────────────────────
        cat_tag = card.find(class_="content-filtering__item-content-category")
        category = cat_tag.get_text(strip=True) if cat_tag else ""

        # ── Image — prefer data-src (real URL) over src (may be placeholder) ──
        img_tag = card.find("img")
        image_url = ""
        if img_tag:
            # Try data-src first (lazy-load real URL), then fall back to src
            raw_src = (img_tag.get("data-src") or "").strip() or \
                      (img_tag.get("src") or "").strip()
            image_url = sanitise_image_url(raw_src)

        print(f"  → {title}  [{date_str}]  img={'✓' if image_url else '✗'}")

        # ── Detail page ────────────────────────────────────────────────────
        detail_data = {"time": "", "venue": "", "description": ""}
        if detail_url:
            detail_data = scrape_event_detail(detail_url)

        emoji = pick_emoji(title, category)
        location = detail_data["venue"] or "HKBU Campus"
        description = detail_data["description"] or f"{category} event at HKBU."

        events.append({
            "title":       title,
            "description": description,
            "date":        date_str,
            "time":        detail_data["time"],
            "location":    location,
            "emoji":       emoji,
            "category":    category,
            "imageUrl":    image_url,
            "detailUrl":   detail_url,
            "source":      "hkbu-sa",
            "createdAt":   int(__import__('time').time() * 1000),
            "rsvpCount":   0,
            "rsvpedBy":    [],
        })

    return events

# ─────────────────────────────────────────────────────────────────────────────
def write_to_firestore(events: list[dict]):
    if not os.path.exists(SERVICE_KEY):
        print(
            "\n❌  Service account key not found!\n"
            f"    Expected:  {SERVICE_KEY}\n\n"
            "    Steps:\n"
            "      1. Firebase Console → Project Settings → Service Accounts\n"
            "      2. Click 'Generate new private key'\n"
            "      3. Save the downloaded file as  scripts/serviceAccountKey.json\n"
            "      4. Re-run this script.\n"
        )
        # Still save events locally so you can inspect them
        out = os.path.join(os.path.dirname(__file__), "events_output.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(events, f, ensure_ascii=False, indent=2)
        print(f"💾  Events saved locally to {out}")
        return

    cred = credentials.Certificate(SERVICE_KEY)
    firebase_admin.initialize_app(cred)
    fs = firestore.client()

    col = fs.collection("events")

    # Remove previously scraped SA events so we don't duplicate
    existing = col.where("source", "==", "hkbu-sa").stream()
    deleted = 0
    for doc in existing:
        doc.reference.delete()
        deleted += 1
    if deleted:
        print(f"🗑   Removed {deleted} old SA event(s) from Firestore")

    for ev in events:
        col.add(ev)
        print(f"  ✓  {ev['title']}")

    print(f"\n🎉  {len(events)} event(s) written to Firestore collection 'events'")

# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    events = scrape_events()
    if not events:
        print("⚠  No events found — the page structure may have changed.")
        sys.exit(1)
    write_to_firestore(events)
