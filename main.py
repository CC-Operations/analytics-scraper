import os
import time
import requests
from datetime import datetime, timezone
from collections import Counter

# Config from environment variables
NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_DATABASE_ID = os.environ["NOTION_DATABASE_ID"]
APIFY_TOKEN = os.environ["APIFY_TOKEN"]

NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
}

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


def get_existing_shortcodes():
    """Return a set of all shortcodes already in the Notion database."""
    shortcodes = set()
    has_more = True
    start_cursor = None

    while has_more:
        payload = {"page_size": 100}
        if start_cursor:
            payload["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query",
            headers=NOTION_HEADERS,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

        for page in data["results"]:
            rt = page["properties"].get("Shortcode", {}).get("rich_text", [])
            if rt:
                shortcodes.add(rt[0]["text"]["content"])

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return shortcodes


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

    # Poll if still running
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


def create_notion_page(post):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    client, account = get_account_info(post.get("inputUrl"))
    posted_date = (post.get("timestamp") or "")[:10] or None
    views = post.get("videoViewCount") or post.get("playCount")
    likes = post.get("likesCount", 0)
    comments = post.get("commentsCount", 0)

    properties = {
        "Post":      {"title":     [{"text": {"content": post["shortCode"]}}]},
        "Client":    {"select":    {"name": client}},
        "Account":   {"select":    {"name": account}},
        "Shortcode": {"rich_text": [{"text": {"content": post["shortCode"]}}]},
        "Post URL":  {"url": post.get("url", "")},
        "Caption":   {"rich_text": [{"text": {"content": (post.get("caption") or "")[:500]}}]},
        "Post Type": {"select":    {"name": POST_TYPE_MAP.get(post.get("type", ""), "Video")}},
        "Date Scraped": {"date":   {"start": now}},
        "Comments":  {"number": comments},
    }

    if views and views > 0:
        properties["Views"] = {"number": views}
    if likes is not None and likes >= 0:
        properties["Likes"] = {"number": likes}
    if posted_date:
        properties["Posted Date"] = {"date": {"start": posted_date}}

    resp = requests.post(
        "https://api.notion.com/v1/pages",
        headers=NOTION_HEADERS,
        json={"parent": {"database_id": NOTION_DATABASE_ID}, "properties": properties},
    )
    return resp.status_code == 200, resp.text


def main():
    print(f"\n=== Instagram Analytics Run — {datetime.now(timezone.utc).isoformat()} ===\n")

    # Step 1: existing shortcodes
    print("Fetching existing shortcodes from Notion...")
    existing = get_existing_shortcodes()
    print(f"  {len(existing)} posts already in database\n")

    # Step 2: scrape in two batches
    print("Scraping Instagram accounts...")
    handles = [a["handle"] for a in ACCOUNTS]
    all_posts = []
    for batch in [handles[:3], handles[3:]]:
        print(f"  Scraping: {', '.join(batch)}")
        posts = scrape_batch(batch)
        all_posts.extend(posts)
        print(f"  → {len(posts)} posts returned")

    print(f"\nTotal scraped: {len(all_posts)} posts\n")

    # Step 3: deduplicate + apply per-account start dates
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
    print(f"New posts (not yet in Notion): {len(new_posts)}")

    per_account = Counter()
    for p in new_posts:
        _, acct = get_account_info(p.get("inputUrl"))
        per_account[acct] += 1
    for acct, n in sorted(per_account.items()):
        print(f"  {acct}: {n}")

    # Step 4: write to Notion
    if not new_posts:
        print("\nNothing new to write. Done.")
        return

    print(f"\nWriting {len(new_posts)} new posts to Notion...")
    ok = fail = 0
    for post in new_posts:
        success, err = create_notion_page(post)
        if success:
            ok += 1
        else:
            fail += 1
            print(f"  FAILED {post['shortCode']}: {err}")

    print(f"\n✓ Written: {ok}  ✗ Failed: {fail}")
    print(f"\n=== Run complete — {datetime.now(timezone.utc).isoformat()} ===\n")


if __name__ == "__main__":
    main()
