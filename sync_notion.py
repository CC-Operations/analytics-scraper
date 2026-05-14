"""
sync_notion.py — Syncs all non-excluded posts from Postgres → Notion Post Analytics database.

Run manually:  railway run python3 sync_notion.py
Nightly cron:  add to main.py after scraping (see bottom of this file)

Notion database: https://www.notion.so/e28bd1e2c1794574816fde368553c71a
Data source:     collection://ac3e07b7-42f6-4bfb-b1df-09066fda1f65
"""

import os
import time
import psycopg2
import requests
from datetime import date

DATABASE_URL  = os.environ["DATABASE_URL"]
NOTION_TOKEN  = os.environ.get("NOTION_API_KEY") or os.environ["NOTION_TOKEN"]
NOTION_DB_ID  = "e28bd1e2c1794574816fde368553c71a"

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
}

PLATFORM_LABEL = {
    "instagram": "Instagram",
    "tiktok":    "TikTok",
    "twitter":   "Twitter",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def notion_get(url, **kwargs):
    r = requests.get(url, headers=HEADERS, **kwargs)
    r.raise_for_status()
    return r.json()

def notion_post(url, payload):
    r = requests.post(url, headers=HEADERS, json=payload)
    r.raise_for_status()
    return r.json()

def notion_patch(url, payload):
    r = requests.patch(url, headers=HEADERS, json=payload)
    r.raise_for_status()
    return r.json()

def rate_limit():
    time.sleep(0.4)  # ~2.5 req/s, safely under Notion's 3/s limit

# ── Step 1: Fetch all existing Notion rows (shortcode → page_id) ──────────────

def fetch_existing_shortcodes():
    print("  Fetching existing Notion rows...")
    mapping = {}   # shortcode → page_id
    cursor = None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = notion_post(
            f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query",
            payload
        )
        for page in data.get("results", []):
            props = page.get("properties", {})
            sc_prop = props.get("Shortcode", {})
            sc = (sc_prop.get("rich_text") or [{}])[0].get("plain_text", "")
            if sc:
                mapping[sc] = page["id"]
        rate_limit()
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    print(f"  Found {len(mapping)} existing rows in Notion")
    return mapping

# ── Step 2: Fetch all non-excluded posts from Postgres ────────────────────────

def fetch_posts():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT
            platform, client, account, shortcode, post_url,
            caption, post_type, views, likes, comments, posted_date
        FROM posts
        WHERE NOT COALESCE(excluded, false)
        ORDER BY posted_date DESC
    """)
    rows = cur.fetchall()
    conn.close()
    print(f"  {len(rows)} non-excluded posts in Postgres")
    return rows

# ── Step 3: Build Notion property payload for a post ─────────────────────────

def build_properties(platform, client, account, shortcode, post_url,
                     caption, post_type, views, likes, comments, posted_date):
    # Title: first 80 chars of caption, or shortcode as fallback
    title = (caption or "").strip()[:80] or shortcode

    props = {
        "Post":        {"title": [{"text": {"content": title}}]},
        "Client":      {"select": {"name": client.capitalize() if client else ""}},
        "Account":     {"multi_select": [{"name": account}]},
        "Platform":    {"select": {"name": PLATFORM_LABEL.get(platform, platform.capitalize())}},
        "Post Type":   {"select": {"name": post_type or "Video"}},
        "Shortcode":   {"rich_text": [{"text": {"content": shortcode or ""}}]},
        "Caption":     {"rich_text": [{"text": {"content": (caption or "")[:2000]}}]},
        "Views":       {"number": views},
        "Likes":       {"number": likes},
        "Comments":    {"number": comments},
        "Date Scraped": {"date": {"start": date.today().isoformat()}},
    }
    if post_url:
        props["Post URL"] = {"url": post_url}
    if posted_date:
        props["Posted Date"] = {"date": {"start": str(posted_date)[:10]}}
    return props

# ── Step 4: Create or update ──────────────────────────────────────────────────

def create_row(props):
    notion_post("https://api.notion.com/v1/pages", {
        "parent": {"database_id": NOTION_DB_ID},
        "properties": props,
    })

def update_row(page_id, views, likes, comments):
    notion_patch(f"https://api.notion.com/v1/pages/{page_id}", {
        "properties": {
            "Views":    {"number": views},
            "Likes":    {"number": likes},
            "Comments": {"number": comments},
            "Date Scraped": {"date": {"start": date.today().isoformat()}},
        }
    })

# ── Main ──────────────────────────────────────────────────────────────────────

def sync():
    print("\n=== Notion Sync ===")

    existing = fetch_existing_shortcodes()
    posts    = fetch_posts()

    created = updated = skipped = errors = 0

    for i, row in enumerate(posts):
        platform, client, account, shortcode, post_url, \
            caption, post_type, views, likes, comments, posted_date = row

        if not shortcode:
            skipped += 1
            continue

        try:
            if shortcode in existing:
                update_row(existing[shortcode], views, likes, comments)
                updated += 1
            else:
                props = build_properties(
                    platform, client, account, shortcode, post_url,
                    caption, post_type, views, likes, comments, posted_date
                )
                create_row(props)
                created += 1
        except Exception as e:
            errors += 1
            print(f"  ERR [{shortcode}]: {e}")

        rate_limit()

        # Progress every 50 posts
        if (i + 1) % 50 == 0:
            print(f"  ... {i+1}/{len(posts)} processed")

    print(f"\n  ✓ {created} created  ↑ {updated} updated  — {skipped} skipped  ✗ {errors} errors")
    print("=== Done ===\n")

if __name__ == "__main__":
    sync()
