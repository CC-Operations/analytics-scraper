import os
import time
from datetime import date, timedelta, datetime, timezone
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

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

def get_last_week_range():
    """Returns (monday, friday) strings for the most recently completed Mon–Fri week."""
    today = date.today()
    # How many days since last Friday (weekday 4)?
    days_since_friday = (today.weekday() - 4) % 7
    if days_since_friday == 0:
        days_since_friday = 7   # If today IS Friday, grab the previous one
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
        # Give charts/animations a moment to settle
        page.wait_for_timeout(2500)
        pdf_bytes = page.pdf(
            format="Letter",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()

    return pdf_bytes


def post_report(client: str, pdf_bytes: bytes, from_date: str, to_date: str):
    """Upload the PDF to the client's Slack channel."""
    slack  = WebClient(token=SLACK_BOT_TOKEN)
    channel = CLIENT_CHANNELS[client]
    filename = f"{client}-analytics-{to_date}.pdf"
    title    = f"{client.capitalize()} — Weekly Analytics ({from_date} → {to_date})"
    comment  = (
        f"📊 *{client.capitalize()} Weekly Report*\n"
        f"Coverage: {from_date} → {to_date}\n"
        f"Full interactive dashboard: {DASHBOARD_URL}/{client}"
    )

    try:
        slack.files_upload_v2(
            channel=channel,
            content=pdf_bytes,
            filename=filename,
            title=title,
            initial_comment=comment,
        )
        print(f"    ✓ Posted to #{channel}")
    except SlackApiError as e:
        print(f"    ✗ Slack error ({channel}): {e.response['error']}")


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
