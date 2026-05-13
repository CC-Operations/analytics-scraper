import os
import time
import psycopg2
import requests
from datetime import datetime, timezone
from collections import Counter

# Config from environment variables
DATABASE_URL = os.environ["DATABASE_URL"]
APIFY_TOKEN = os.environ["APIFY_TOKEN"]

ACCOUNTS = [
    {"handle": "cosmos",        "client": "Cosmos", "account": "@cosmos",        "start_date": "2026-05-13"},
    {"handle": "poke",          "client": "Poke",   "account": "@poke",          "start_date": None},
    {"handle": "wabimaxxing",   "client": "Wabi",   "account": "@wabimaxxing",   "start_date": None},
    {"handle": "gotwabi",       "client": "Wabi",   "account": "@gotwabi",       "start_date": None},
    {"handle": "finthetourist", "client": "Wabi",   "account": "@finthetourist", "start_date": None},
    {"handle": "yahoo",         "client": "Yahoo",  "account": "@yahoo",         "start_date": "2026-05-13"},
]

POST_TYPE_MAP = {
    "Video": "Video", "GraphVideo": "Video",
    "Image": "Image", "GraphImage": "Image",
    "Sidecar": "Sidecar", "GraphSidecar": "Sidecar",
}


def get_db():
    return psycopg2.connect(DATABASE_URL)


def setup_db():
    """Create tables if they don't exist."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    client TEXT,
                    account TEXT,
                    platform TEXT DEFAULT 'instagram',
                    shortcode TEXT UNIQUE,
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
        conn.commit()
    print("  Database ready.")


def get_existing_shortcodes():
    """Return a set of all shortcodes already in the database."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT shortcode FROM posts WHERE platform = 'instagram'")
            return {row[0] for row in cur.fetchall()}


def scrape_batch(handles):
    """Run apify/instagram-scraper for a batch of handles and return posts."""
    direct_urls = [f"https://www.instagram.com/{h}/" for h in handles]

    run_resp = requests.post(
        "https://api.apify.com/v2/acts/apify~instagram-scraper/runs",
        params={"token": APIFY_TOKEN, "waitForFinish": 300},
        json={"directUrls": direct_urls, "resultsType": "posts", "resultsLimit": 20},
    )
    run_resp.raise_for_status()
    run = run_resp.json()["data"]
    run_id = run["id"]
    dataset_id = run["defaultDatasetId"]
    status = run["status"]

    while status not in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
        time.sleep(10)
        status_resp = requests.get(
            f"https://api.apify.com/v2/actor-runs/{run_id}",
            params={"token": APIFY_TOKEN},
        )
        status = status_resp.json()["data"]["status"]

    if status != "SUCCEEDED":
        raise RuntimeError(f"Apify run {run_id} ended with status: {status}")

    items_resp = requests.get(
        f"https://api.apify.com/v2/datasets/{dataset_id}/items",
        params={
            "token": APIFY_TOKEN,
            "fields": "shortCode,timestamp,url,caption,videoViewCount,likesCount,commentsCount,type,inputUrl",
            "limit": 200,
        },
    )
    items_resp.raise_for_status()
    return items_resp.json()


def get_account_info(input_url):
    for acct in ACCOUNTS:
        if acct["handle"] in (input_url or ""):
            return acct["client"], acct["account"]
    return "Unknown", "Unknown"


def insert_post(post):
    client, account = get_account_info(post.get("inputUrl"))
    posted_date = (post.get("timestamp") or "")[:10] or None
    views = post.get("videoViewCount") or post.get("playCount")
    likes = post.get("likesCount", 0)
    comments = post.get("commentsCount", 0)
    post_type = POST_TYPE_MAP.get(post.get("type", ""), "Video")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO posts
                    (client, account, platform, shortcode, post_url, caption, post_type, views, likes, comments, posted_date)
                VALUES (%s, %s, 'instagram', %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (shortcode) DO NOTHING
            """, (
                client,
                account,
                post["shortCode"],
                post.get("url", ""),
                (post.get("caption") or "")[:500],
                post_type,
                views if views and views > 0 else None,
                likes if likes is not None and likes >= 0 else None,
                comments,
                posted_date,
            ))
        conn.commit()


def main():
    print(f"\n=== Instagram Analytics Run — {datetime.now(timezone.utc).isoformat()} ===\n")

    # Step 1: setup DB schema
    print("Setting up database...")
    setup_db()

    # Step 2: existing shortcodes
    print("Fetching existing shortcodes from Postgres...")
    existing = get_existing_shortcodes()
    print(f"  {len(existing)} posts already in database\n")

    # Step 3: scrape in two batches
    print("Scraping Instagram accounts...")
    handles = [a["handle"] for a in ACCOUNTS]
    all_posts = []
    for batch in [handles[:3], handles[3:]]:
        print(f"  Scraping: {', '.join(batch)}")
        posts = scrape_batch(batch)
        all_posts.extend(posts)
        print(f"  → {len(posts)} posts returned")

    print(f"\nTotal scraped: {len(all_posts)} posts\n")

    # Step 4: deduplicate + apply per-account start dates
    start_date_map = {a["account"]: a["start_date"] for a in ACCOUNTS}

    def is_new(post):
        if not post.get("shortCode"):
            return False
        if post["shortCode"] in existing:
            return False
        _, account = get_account_info(post.get("inputUrl"))
        start_date = start_date_map.get(account)
        if start_date:
            post_date = (post.get("timestamp") or "")[:10]
            if post_date < start_date:
                return False
        return True

    new_posts = [p for p in all_posts if is_new(p)]
    print(f"New posts (not yet in database): {len(new_posts)}")

    per_account = Counter()
    for p in new_posts:
        _, acct = get_account_info(p.get("inputUrl"))
        per_account[acct] += 1
    for acct, n in sorted(per_account.items()):
        print(f"  {acct}: {n}")

    # Step 5: write to Postgres
    if not new_posts:
        print("\nNothing new to write. Done.")
        return

    print(f"\nWriting {len(new_posts)} new posts to Postgres...")
    ok = fail = 0
    for post in new_posts:
        try:
            insert_post(post)
            ok += 1
        except Exception as e:
            fail += 1
            print(f"  FAILED {post['shortCode']}: {e}")

    print(f"\n✓ Written: {ok}  ✗ Failed: {fail}")
    print(f"\n=== Run complete — {datetime.now(timezone.utc).isoformat()} ===\n")


if __name__ == "__main__":
    main()
