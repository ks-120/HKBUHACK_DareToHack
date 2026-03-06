"""
HKBU SA Events Scraper  (fast mode — skips detail pages)
=========================================================
Scrapes upcoming events from https://sa.hkbu.edu.hk and writes them to Firestore.
Images are re-uploaded to Cloudinary so they load correctly on GitHub Pages
(sa.hkbu.edu.hk sends no CORS headers, blocking browsers on other origins).

Usage:
  cd /Users/kshing.120/Desktop/BUHack/BUHACK-DareToHack
  .venv/bin/python scripts/scrape_events.py
"""

import json, re, sys, os, hashlib, time
import requests
from datetime import datetime
from urllib.parse import urljoin, quote

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("playwright not found — run: .venv/bin/pip install playwright && .venv/bin/playwright install chromium")

try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("beautifulsoup4 not found — run: .venv/bin/pip install beautifulsoup4 lxml")

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    sys.exit("firebase-admin not found — run: .venv/bin/pip install firebase-admin")

# ── Config ────────────────────────────────────────────────────────────────────
LIST_URL    = "https://sa.hkbu.edu.hk/content/sa/en/live/live_events.html?pageSize=100&page=0"
SA_DOMAIN   = "https://sa.hkbu.edu.hk"
SERVICE_KEY = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")

CLOUDINARY_CLOUD  = "dfmzbrn3q"
CLOUDINARY_PRESET = "avatar_unsigned"
CLOUDINARY_UPLOAD = f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD}/image/upload"

# ── Cloudinary upload ─────────────────────────────────────────────────────────
def upload_to_cloudinary(image_url: str, public_id: str) -> str:
    """Re-host an sa.hkbu.edu.hk image on Cloudinary (CORS-friendly CDN)."""
    if not image_url:
        return ""
    try:
        resp = requests.post(
            CLOUDINARY_UPLOAD,
            data={
                "file":          image_url,
                "upload_preset": CLOUDINARY_PRESET,
                "folder":        "events",          # allowed with unsigned preset
                "public_id":     public_id,         # slug only, no slashes
                # "overwrite" is NOT allowed with unsigned presets — removed
            },
            timeout=40,
        )
        if resp.status_code == 200:
            url = resp.json().get("secure_url", "")
            print(f"      ☁  Cloudinary OK → {url}")
            return url
        print(f"      ⚠  Cloudinary {resp.status_code}: {resp.text[:200]}")
        return ""
    except Exception as e:
        print(f"      ⚠  Cloudinary error: {e}")
        return ""

# ── Emoji map ─────────────────────────────────────────────────────────────────
EMOJI_MAP = {
    "sports":"🏃","wellness":"🧘","music":"🎵","art":"🎨","culture":"🎭",
    "drama":"🎭","theatre":"🎭","film":"🎬","gaming":"🎮","tech":"💻",
    "coding":"💻","hack":"💻","language":"💬","food":"🍜","photography":"📷",
    "hike":"🥾","hiking":"🥾","study":"📚","workshop":"🛠️","orientation":"🎓",
    "open day":"🎓","fair":"🎪","exhibition":"🖼️","concert":"🎶","talk":"🗣️",
    "seminar":"🗣️","volunteer":"🤝","charity":"❤️","trip":"✈️","exchange":"🌏",
}

def pick_emoji(title: str, category: str) -> str:
    text = (title + " " + category).lower()
    for kw, em in EMOJI_MAP.items():
        if kw in text:
            return em
    return "🎉"

# ── Helpers ───────────────────────────────────────────────────────────────────
def sanitise_image_url(src: str) -> str:
    if not src or src.startswith("data:"):
        return ""
    if not src.startswith("http"):
        src = urljoin(SA_DOMAIN, src)
    parts = src.split("?", 1)
    path  = quote(parts[0], safe=":/%#=&+")
    return path + ("?" + parts[1] if len(parts) > 1 else "")

def parse_date_str(raw: str) -> str:
    raw = raw.strip()
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", raw)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return datetime(y, mo, d).strftime("%b %d, %Y")
    return raw

# ── Single Playwright session for the whole run ───────────────────────────────
def fetch_html_once(url: str, page, wait_ms: int = 6000) -> str:
    """Reuse an already-open Playwright page — much faster than launching a new browser each time."""
    try:
        page.goto(url, timeout=60_000, wait_until="domcontentloaded")
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(wait_ms)
        return page.content()
    except Exception as e:
        print(f"    ⚠  fetch failed for {url}: {e}")
        return ""

# ── Main scrape ───────────────────────────────────────────────────────────────
def scrape_events() -> list[dict]:
    events = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page    = browser.new_page()

        # ── 1. Listing page ───────────────────────────────────────────────
        print(f"🌐  Loading listing page …")
        html = fetch_html_once(LIST_URL, page, wait_ms=6000)
        if not html:
            browser.close()
            return []

        soup  = BeautifulSoup(html, "lxml")
        cards = soup.find_all(class_="content-filtering__item")
        print(f"✅  Found {len(cards)} event card(s)\n")

        for i, card in enumerate(cards, 1):
            # Title
            title_tag = card.find(class_="content-filtering__item-content-title")
            title = title_tag.get_text(strip=True) if title_tag else "Untitled"

            # Date
            date_tag = card.find(class_="content-filtering__item-content-date")
            date_str = parse_date_str(date_tag.get_text(strip=True) if date_tag else "")

            # Category
            cat_tag  = card.find(class_="content-filtering__item-content-category")
            category = cat_tag.get_text(strip=True) if cat_tag else ""

            # Detail URL
            link_tag   = card.find_parent("a", class_="content-filtering__item-link") or \
                         card.find("a", class_="content-filtering__item-link")
            detail_url = ""
            if link_tag and link_tag.get("href"):
                href = link_tag["href"]
                detail_url = href if href.startswith("http") else urljoin(SA_DOMAIN, href)

            # Image — prefer data-src (lazy-load real URL) over src (may be placeholder)
            img_tag      = card.find("img")
            sa_image_url = ""
            if img_tag:
                raw = (img_tag.get("data-src") or "").strip() or (img_tag.get("src") or "").strip()
                sa_image_url = sanitise_image_url(raw)

            print(f"  [{i}/{len(cards)}] {title}  |  {date_str}")

            # ── Upload image to Cloudinary ─────────────────────────────────
            image_url = ""
            if sa_image_url:
                slug = hashlib.md5(sa_image_url.encode()).hexdigest()[:12]
                image_url = upload_to_cloudinary(sa_image_url, slug)   # slug only, no slashes
                if not image_url:
                    image_url = sa_image_url   # fall back to original on failure

            events.append({
                "title":       title,
                "description": f"{category} event at HKBU.".strip() if category else "HKBU Campus event.",
                "date":        date_str,
                "time":        "",
                "location":    "HKBU Campus",
                "emoji":       pick_emoji(title, category),
                "category":    category,
                "imageUrl":    image_url,
                "detailUrl":   detail_url,
                "source":      "hkbu-sa",
                "createdAt":   int(time.time() * 1000),
                "rsvpCount":   0,
                "rsvpedBy":    [],
            })

        browser.close()

    return events

# ── Firestore write ───────────────────────────────────────────────────────────
def write_to_firestore(events: list[dict]):
    if not os.path.exists(SERVICE_KEY):
        out = os.path.join(os.path.dirname(__file__), "events_output.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(events, f, ensure_ascii=False, indent=2)
        print(f"\n❌  serviceAccountKey.json not found — saved locally to {out}")
        return

    cred = credentials.Certificate(SERVICE_KEY)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    fs  = firestore.client()
    col = fs.collection("events")

    # Delete old scraped events
    deleted = 0
    for doc in col.where("source", "==", "hkbu-sa").stream():
        doc.reference.delete()
        deleted += 1
    if deleted:
        print(f"\n🗑   Deleted {deleted} old SA event(s)")

    for ev in events:
        col.add(ev)
        print(f"  ✓  {ev['title']}")

    print(f"\n🎉  {len(events)} event(s) written to Firestore!")

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    evs = scrape_events()
    if not evs:
        print("⚠  No events found.")
        sys.exit(1)
    print(f"\n📦  Scraped {len(evs)} events. Writing to Firestore …\n")
    write_to_firestore(evs)
