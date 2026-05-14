"""
One-time backfill: pull all Wabi Instagram posts from 2025-12-24 onwards.
Run with: railway run python3 backfill_wabi.py
"""
import os, time, psycopg2, requests

DATABASE_URL = os.environ["DATABASE_URL"]
APIFY_TOKEN  = os.environ["APIFY_TOKEN"]
START_DATE   = "2025-12-24"

WABI_ACCOUNTS = [
    {"handle": "wabimaxxing",   "account": "@wabimaxxing"},
    {"handle": "gotwabi",       "account": "@gotwabi"},
    {"handle": "finthetourist", "account": "@finthetourist"},
]

POST_TYPE_MAP = {
    "Video": "Video", "GraphVideo": "Video",
    "Image": "Image", "GraphImage": "Image",
    "Sidecar": "Carousel", "GraphSidecar": "Carousel",
}

def get_db():
    return psycopg2.connect(DATABASE_URL)

def get_existing_keys():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT shortcode FROM posts WHERE platform = 'instagram' AND client = 'Wabi'")
            return {row[0] for row in cur.fetchall()}

def insert_post(account, shortcode, post_url, caption, post_type, views, likes, comments, posted_date):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO posts
                    (client, account, platform, shortcode, post_url, caption,
                     post_type, views, likes, comments, posted_date)
                VALUES ('Wabi', %s, 'instagram', %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (platform, shortcode) DO NOTHING
            """, (account, shortcode, post_url, (caption or "")[:500],
                  post_type, views, likes, comments, posted_date))
        conn.commit()

def run_actor(actor_id, input_data, wait=300):
    resp = requests.post(
        f"https://api.apify.com/v2/acts/{actor_id}/runs",
        params={"token": APIFY_TOKEN, "waitForFinish": wait},
        json=input_data,
    )
    resp.raise_for_status()
    run = resp.json()["data"]
    run_id, dataset_id, status = run["id"], run["defaultDatasetId"], run["status"]
    while status not in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
        time.sleep(10)
        status = requests.get(
            f"https://api.apify.com/v2/actor-runs/{run_id}",
            params={"token": APIFY_TOKEN},
        ).json()["data"]["status"]
    if status != "SUCCEEDED":
        raise RuntimeError(f"Run {run_id} ended: {status}")
    items = requests.get(
        f"https://api.apify.com/v2/datasets/{dataset_id}/items",
        params={"token": APIFY_TOKEN, "limit": 500},
    )
    items.raise_for_status()
    return items.json()

def main():
    print(f"\n=== Wabi Instagram Backfill (from {START_DATE}) ===")
    existing = get_existing_keys()
    print(f"  {len(existing)} Wabi IG posts already in DB\n")

    for acct in WABI_ACCOUNTS:
        print(f"  Scraping @{acct['handle']} (limit 200)...")
        try:
            posts = run_actor("apify~instagram-scraper", {
                "directUrls": [f"https://www.instagram.com/{acct['handle']}/"],
                "resultsType": "posts",
                "resultsLimit": 200,
            })
        except Exception as e:
            print(f"  ERROR: {e}")
            continue

        print(f"  → {len(posts)} posts returned")
        ok = skip_old = skip_dup = fail = 0
        for post in posts:
            sc = post.get("shortCode")
            if not sc:
                continue
            if sc in existing:
                skip_dup += 1
                continue
            post_date = (post.get("timestamp") or "")[:10]
            if post_date and post_date < START_DATE:
                skip_old += 1
                continue
            views = post.get("videoViewCount") or post.get("playCount")
            try:
                insert_post(
                    acct["account"], sc,
                    post.get("url", ""), post.get("caption"),
                    POST_TYPE_MAP.get(post.get("type", ""), "Video"),
                    views if views and views > 0 else None,
                    post.get("likesCount"), post.get("commentsCount"),
                    post_date or None,
                )
                existing.add(sc)
                ok += 1
            except Exception as e:
                fail += 1
                print(f"    FAILED {sc}: {e}")
        print(f"  ✓ {ok} new  · {skip_dup} already existed  · {skip_old} before {START_DATE}  · {fail} errors\n")

    print("=== Done ===\n")

if __name__ == "__main__":
    main()
