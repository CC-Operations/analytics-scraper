import os
import time
import psycopg2
import requests
from datetime import datetime, timezone
from collections import Counter

DATABASE_URL = os.environ["DATABASE_URL"]
APIFY_TOKEN = os.environ["APIFY_TOKEN"]

# ── Account configs ───────────────────────────────────────────────────────────

INSTAGRAM_ACCOUNTS = [
    {"handle": "cosmos",        "client": "Cosmos", "account": "@cosmos",        "start_date": "2026-05-13"},
    {"handle": "poke",          "client": "Poke",   "account": "@poke",          "start_date": None},
    {"handle": "wabimaxxing",   "client": "Wabi",   "account": "@wabimaxxing",   "start_date": None},
    {"handle": "gotwabi",       "client": "Wabi",   "account": "@gotwabi",       "start_date": None},
    {"handle": "finthetourist", "client": "Wabi",   "account": "@finthetourist", "start_date": None},
    {"handle": "yahoo",         "client": "Yahoo",  "account": "@yahoo",         "start_date": "2026-05-13"},
    {"handle": "oliveapp",      "client": "Olive",  "account": "@oliveapp",      "start_date": "2026-02-15"},
]

TIKTOK_ACCOUNTS = [
    {"handle": "inspirethecosmos", "client": "Cosmos", "account": "@inspirethecosmos", "start_date": "2026-05-13"},
    {"handle": "wabimaxxing",      "client": "Wabi",   "account": "@wabimaxxing",      "start_date": "2025-12-24"},
]

TWITTER_ACCOUNTS = [
    {"handle": "thecosmos", "client": "Cosmos", "account": "@thecosmos", "start_date": "2026-05-13"},
    {"handle": "wabi",      "client": "Wabi",   "account": "@wabi",      "start_date": "2025-12-24"},
]

POST_TYPE_MAP = {
    "Video": "Video", "GraphVideo": "Video",
    "Image": "Image", "GraphImage": "Image",
    "Sidecar": "Carousel", "GraphSidecar": "Carousel",
}

# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(DATABASE_URL)


def setup_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    client TEXT,
                    account TEXT,
                    platform TEXT DEFAULT 'instagram',
                    shortcode TEXT,
                    post_url TEXT,
                    caption TEXT,
                    post_type TEXT,
                    views INTEGER,
                    likes INTEGER,
                    comments INTEGER,
                    posted_date DATE,
                    date_scraped TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            # Migrate: drop old single-column unique, add platform+shortcode unique
            cur.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'posts_shortcode_key'
                    ) THEN
                        ALTER TABLE posts DROP CONSTRAINT posts_shortcode_key;
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'posts_platform_shortcode_key'
                    ) THEN
                        ALTER TABLE posts ADD CONSTRAINT posts_platform_shortcode_key UNIQUE (platform, shortcode);
                    END IF;
                END $$;
            """)
        conn.commit()
    print("  Database ready.")


def get_existing_keys(platform):
    """Return set of shortcodes already in DB for this platform."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT shortcode FROM posts WHERE platform = %s", (platform,))
            return {row[0] for row in cur.fetchall()}


def insert_post(platform, client, account, shortcode, post_url, caption,
                post_type, views, likes, comments, posted_date):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO posts
                    (client, account, platform, shortcode, post_url, caption,
                     post_type, views, likes, comments, posted_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (platform, shortcode) DO UPDATE SET
                    views      = EXCLUDED.views,
                    likes      = EXCLUDED.likes,
                    comments   = EXCLUDED.comments,
                    post_url   = COALESCE(EXCLUDED.post_url, posts.post_url),
                    caption    = COALESCE(NULLIF(EXCLUDED.caption,''), posts.caption),
                    post_type  = COALESCE(EXCLUDED.post_type, posts.post_type),
                    posted_date = COALESCE(EXCLUDED.posted_date, posts.posted_date)
            """, (client, account, platform, shortcode, post_url,
                  (caption or "")[:500], post_type, views, likes, comments, posted_date))
        conn.commit()

# ── Apify helper ──────────────────────────────────────────────────────────────

def run_actor(actor_id, input_data, wait=300):
    run_resp = requests.post(
        f"https://api.apify.com/v2/acts/{actor_id}/runs",
        params={"token": APIFY_TOKEN, "waitForFinish": wait},
        json=input_data,
    )
    run_resp.raise_for_status()
    run = run_resp.json()["data"]
    run_id, dataset_id, status = run["id"], run["defaultDatasetId"], run["status"]

    while status not in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
        time.sleep(10)
        status = requests.get(
            f"https://api.apify.com/v2/actor-runs/{run_id}",
            params={"token": APIFY_TOKEN},
        ).json()["data"]["status"]

    if status != "SUCCEEDED":
        raise RuntimeError(f"Apify run {run_id} ended with status: {status}")

    items_resp = requests.get(
        f"https://api.apify.com/v2/datasets/{dataset_id}/items",
        params={"token": APIFY_TOKEN, "limit": 200},
    )
    items_resp.raise_for_status()
    return items_resp.json()

# ── Instagram ─────────────────────────────────────────────────────────────────

def scrape_instagram():
    print("\n── Instagram ──")
    handles = [a["handle"] for a in INSTAGRAM_ACCOUNTS]
    start_map = {a["account"]: a["start_date"] for a in INSTAGRAM_ACCOUNTS}

    def acct_for(input_url):
        for a in INSTAGRAM_ACCOUNTS:
            if a["handle"] in (input_url or ""):
                return a["client"], a["account"]
        return "Unknown", "Unknown"

    all_posts = []
    for batch in [handles[:3], handles[3:]]:
        print(f"  Scraping: {', '.join(batch)}")
        try:
            posts = run_actor("apify~instagram-scraper", {
                "directUrls": [f"https://www.instagram.com/{h}/" for h in batch],
                "resultsType": "posts",
                "resultsLimit": 500,
            })
            all_posts.extend(posts)
            print(f"  → {len(posts)} posts")
        except Exception as e:
            print(f"  ERROR: {e}")

    ok = fail = 0
    for post in all_posts:
        sc = post.get("shortCode")
        if not sc:
            continue
        client, account = acct_for(post.get("inputUrl"))
        start = start_map.get(account)
        post_date = (post.get("timestamp") or "")[:10]
        if start and post_date < start:
            continue
        views = post.get("videoViewCount") or post.get("playCount")
        try:
            insert_post(
                "instagram", client, account, sc,
                post.get("url", ""), post.get("caption"),
                POST_TYPE_MAP.get(post.get("type", ""), "Video"),
                views if views and views > 0 else None,
                post.get("likesCount"), post.get("commentsCount"),
                post_date or None,
            )
            ok += 1
        except Exception as e:
            fail += 1
            print(f"  FAILED {sc}: {e}")
    print(f"  ✓ {ok} written  ✗ {fail} failed")

# ── TikTok ────────────────────────────────────────────────────────────────────

def scrape_tiktok():
    print("\n── TikTok ──")
    for acct in TIKTOK_ACCOUNTS:
        print(f"  Scraping: {acct['handle']}")
        try:
            posts = run_actor("clockworks~free-tiktok-scraper", {
                "profiles": [f"https://www.tiktok.com/@{acct['handle']}"],
                "resultsPerPage": 200,
            })
        except Exception as e:
            print(f"  ERROR: {e}")
            continue

        ok = fail = 0
        for post in posts:
            sc = str(post.get("id") or "")
            if not sc:
                continue
            post_date = None
            ts = post.get("createTime")
            if ts:
                post_date = datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%d")
            if acct["start_date"] and post_date and post_date < acct["start_date"]:
                continue
            try:
                insert_post(
                    "tiktok", acct["client"], acct["account"], sc,
                    post.get("webVideoUrl", ""), post.get("text"),
                    "Video",
                    post.get("playCount"), post.get("diggCount"), post.get("commentCount"),
                    post_date,
                )
                ok += 1
            except Exception as e:
                fail += 1
                print(f"  FAILED {sc}: {e}")
        print(f"  ✓ {ok} written  ✗ {fail} failed")

# ── Twitter/X ─────────────────────────────────────────────────────────────────

def parse_tweet_date(raw):
    """Parse Twitter createdAt into YYYY-MM-DD.
    Handles:
      - ISO:            '2026-05-13...'
      - Full Twitter:   'Wed May 13 12:00:00 +0000 2026'
      - Short no-year:  'Wed May 13'
    """
    if not raw:
        return None
    raw = raw.strip()
    # Already ISO format
    if len(raw) >= 10 and raw[4] == "-":
        return raw[:10]
    # Full Twitter API format: "Wed May 13 12:00:00 +0000 2026"
    for fmt in ("%a %b %d %H:%M:%S %z %Y", "%a %b %d %H:%M:%S %Z %Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    # Short no-year fallback: "Wed May 13"
    try:
        now = datetime.now()
        d = datetime.strptime(raw[:10], "%a %b %d")
        year = now.year
        if d.month > now.month:
            year -= 1
        return d.replace(year=year).strftime("%Y-%m-%d")
    except ValueError:
        return None

def scrape_twitter():
    print("\n── Twitter/X ──")
    for acct in TWITTER_ACCOUNTS:
        print(f"  Scraping: {acct['handle']}")
        try:
            posts = run_actor("apidojo~tweet-scraper", {
                "startUrls": [f"https://x.com/{acct['handle']}"],
                "maxItems": 200,
            })
        except Exception as e:
            print(f"  ERROR: {e}")
            continue

        ok = fail = 0
        for post in posts:
            sc = str(post.get("id") or "")
            if not sc:
                continue
            post_date = parse_tweet_date(post.get("createdAt"))
            if acct["start_date"] and post_date and post_date < acct["start_date"]:
                continue
            try:
                insert_post(
                    "twitter", acct["client"], acct["account"], sc,
                    post.get("url", ""), post.get("text"),
                    "Tweet",
                    post.get("viewCount"), post.get("likeCount"), post.get("replyCount"),
                    post_date,
                )
                ok += 1
            except Exception as e:
                fail += 1
                print(f"  FAILED {sc}: {e}")
        print(f"  ✓ {ok} written  ✗ {fail} failed")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"\n=== Analytics Run — {datetime.now(timezone.utc).isoformat()} ===")
    setup_db()
    scrape_instagram()
    scrape_tiktok()
    scrape_twitter()
    # Sync to Notion after scraping (only if token is set)
    if os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_API_KEY"):
        try:
            from sync_notion import sync as sync_notion
            sync_notion()
        except Exception as e:
            print(f"  Notion sync error: {e}")
    print(f"\n=== Done — {datetime.now(timezone.utc).isoformat()} ===\n")


if __name__ == "__main__":
    from flask import Flask, request, jsonify
    import threading

    app = Flask(__name__)
    _scrape_lock = threading.Lock()
    _scrape_running = False

    def run_scrape():
        global _scrape_running
        with _scrape_lock:
            _scrape_running = True
        try:
            main()
        finally:
            with _scrape_lock:
                _scrape_running = False

    @app.route("/health")
    def health():
        return jsonify({"ok": True})

    @app.route("/refresh", methods=["POST"])
    def refresh():
        secret = os.environ.get("REFRESH_SECRET", "")
        auth   = request.headers.get("Authorization", "")
        if secret and auth != f"Bearer {secret}":
            return jsonify({"error": "unauthorized"}), 401
        with _scrape_lock:
            already = _scrape_running
        if already:
            return jsonify({"status": "already_running"})
        threading.Thread(target=run_scrape, daemon=True).start()
        return jsonify({"status": "started"})

    # Internal 8-hour scheduler
    def _scheduler():
        while True:
            time.sleep(8 * 3600)
            with _scrape_lock:
                if not _scrape_running:
                    threading.Thread(target=run_scrape, daemon=True).start()

    # Boot: run initial scrape + start scheduler
    threading.Thread(target=run_scrape, daemon=True).start()
    threading.Thread(target=_scheduler, daemon=True).start()

    port = int(os.environ.get("PORT", 8080))
    print(f"Starting web server on port {port}")
    app.run(host="0.0.0.0", port=port, use_reloader=False)
