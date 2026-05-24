import os
import requests
from datetime import date, timedelta

SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
DASHBOARD_URL   = os.environ.get("DASHBOARD_URL", "").rstrip("/")

# Map client key → Slack channel name
CLIENT_CHANNELS = {
    "cosmos": "int-cosmos",
    "poke":   "int-poke",
    "wabi":   "int-wabi",
    "yahoo":  "int-yahoo",
    "olive":  "int-olive",
}

_channel_id_cache: dict = {}

def get_channel_id(channel_name: str) -> str | None:
    """Resolve channel name → ID, with caching."""
    if channel_name in _channel_id_cache:
        return _channel_id_cache[channel_name]

    # Query private and public separately — Slack drops private channels
    # when both types are combined in a single request.
    for ch_type in ("private_channel", "public_channel"):
        r = requests.get(
            "https://slack.com/api/conversations.list",
            headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"},
            params={"types": ch_type, "limit": 200},
            timeout=15,
        )
        for ch in r.json().get("channels", []):
            _channel_id_cache[ch["name"]] = ch["id"]

    result = _channel_id_cache.get(channel_name)
    if not result:
        print(f"    ✗ Channel not found: #{channel_name} (bot not invited?)")
    return result


def get_last_week_range():
    """Returns (monday, friday) strings for the most recently completed Mon–Fri week."""
    today = date.today()
    days_since_friday = (today.weekday() - 4) % 7
    if days_since_friday == 0:
        days_since_friday = 7
    last_friday = today - timedelta(days=days_since_friday)
    last_monday = last_friday - timedelta(days=4)
    return last_monday.isoformat(), last_friday.isoformat()


def generate_pdf(client: str, from_date: str, to_date: str) -> bytes:
    """Render the report page headlessly and return PDF bytes."""
    from playwright.sync_api import sync_playwright

    url = f"{DASHBOARD_URL}/{client}/report?from={from_date}&to={to_date}"
    print(f"    Rendering {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(url, wait_until="networkidle", timeout=60_000)
        page.wait_for_timeout(2500)
        pdf_bytes = page.pdf(
            format="Letter",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()

    return pdf_bytes


def post_report(client: str, pdf_bytes: bytes, from_date: str, to_date: str):
    """Upload PDF to Slack using the 3-step files API directly."""
    channel_name = CLIENT_CHANNELS[client]
    channel_id   = get_channel_id(channel_name)
    if not channel_id:
        return

    filename = f"{client}-analytics-{to_date}.pdf"
    title    = f"{client.capitalize()} — Weekly Analytics ({from_date} → {to_date})"
    comment  = (
        f"📊 *{client.capitalize()} Weekly Report*\n"
        f"Coverage: {from_date} → {to_date}\n"
        f"Full interactive dashboard: {DASHBOARD_URL}/{client}"
    )
    headers = {"Authorization": f"Bearer {SLACK_BOT_TOKEN}"}

    # Step 1: Get upload URL
    r1 = requests.post(
        "https://slack.com/api/files.getUploadURLExternal",
        headers=headers,
        data={"filename": filename, "length": str(len(pdf_bytes))},
        timeout=15,
    )
    d1 = r1.json()
    if not d1.get("ok"):
        print(f"    ✗ getUploadURL error: {d1.get('error')}")
        return
    upload_url = d1["upload_url"]
    file_id    = d1["file_id"]

    # Step 2: Upload the file bytes
    r2 = requests.post(
        upload_url,
        data=pdf_bytes,
        headers={"Content-Type": "application/pdf"},
        timeout=60,
    )
    if r2.status_code not in (200, 201):
        print(f"    ✗ Upload failed: HTTP {r2.status_code}")
        return

    # Step 3: Complete the upload, post to channel
    r3 = requests.post(
        "https://slack.com/api/files.completeUploadExternal",
        headers=headers,
        json={
            "files": [{"id": file_id, "title": title}],
            "channel_id": channel_id,
            "initial_comment": comment,
        },
        timeout=15,
    )
    d3 = r3.json()
    if d3.get("ok"):
        print(f"    ✓ Posted to #{channel_name}")
    else:
        print(f"    ✗ completeUpload error: {d3.get('error')} — {d3}")


def sync():
    """Generate and post weekly PDF reports for all clients."""
    if not SLACK_BOT_TOKEN:
        print("  SLACK_BOT_TOKEN not set — skipping weekly reports")
        return
    if not DASHBOARD_URL:
        print("  DASHBOARD_URL not set — skipping weekly reports")
        return

    from_date, to_date = get_last_week_range()
    print(f"\n── Weekly Report Bot ({from_date} → {to_date}) ──")

    for client in CLIENT_CHANNELS:
        print(f"  {client}:")
        try:
            pdf = generate_pdf(client, from_date, to_date)
            post_report(client, pdf, from_date, to_date)
        except Exception as e:
            print(f"    ERROR: {e}")

    print("── Weekly reports done ──")
