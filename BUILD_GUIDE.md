# Creator Camp Analytics Dashboard — Build Guide

## What We Built
A fully automated multi-client analytics dashboard for Creator Camp that:
- Scrapes Instagram, TikTok, and Twitter nightly via Apify
- Stores everything in a Postgres database on Railway
- Displays in a Next.js dashboard on Vercel with per-client tabs, charts, and CPI tracking

---

## Architecture

```
Apify (Instagram / TikTok / Twitter scrapers)
        ↓
Railway Python Cron Job (nightly 11pm EST)
        ↓
Railway Postgres (analytics-db)
        ↓
Vercel Next.js Dashboard
```

---

## Clients & Accounts

| Client | Instagram | TikTok | Twitter | Retainer |
|--------|-----------|--------|---------|----------|
| Cosmos | @cosmos | @inspirethecosmos | @thecosmos | $40,000/mo |
| Poke | @poke | — | — | $35,000/mo |
| Wabi | @wabimaxxing, @gotwabi, @finthetourist | — | — | $35,000/mo |
| Yahoo | @yahoo | — | — | — |
| Olive | @oliveapp | — | — | $15,000/mo |

---

## Tech Stack

| Layer | Service | Cost |
|-------|---------|------|
| Scraper | Railway Pro (cron + Python) | $20/mo |
| Database | Railway Postgres | included |
| Data source | Apify Starter | $49/mo |
| Frontend | Vercel Hobby | Free |
| Repo | GitHub (public) | Free |

---

## Repository Structure

```
apify-analytics-scraper/
├── main.py                    # Python scraper (runs nightly on Railway)
├── backfill_wabi.py           # One-off backfill script for Wabi IG history
├── requirements.txt           # psycopg2-binary, requests
├── BUILD_GUIDE.md             # This file
├── PROJECT_STATE.md           # Current status checklist
└── dashboard/                 # Next.js app (deployed to Vercel)
    ├── app/
    │   ├── page.tsx           # Agency HQ homepage
    │   ├── globals.css        # Animations (fadeUp, pinkPulse)
    │   ├── [client]/
    │   │   └── page.tsx       # Per-client analytics page
    │   └── api/
    │       ├── posts/route.ts     # GET posts, PATCH exclude toggle
    │       └── overview/route.ts  # Aggregated stats for HQ page
    └── lib/
        └── db.ts              # Postgres connection pool
```

---

## Database Schema

```sql
posts (
    id            SERIAL PRIMARY KEY,
    client        TEXT,
    account       TEXT,
    platform      TEXT,           -- 'instagram', 'tiktok', 'twitter'
    shortcode     TEXT,
    post_url      TEXT,
    caption       TEXT,
    post_type     TEXT,           -- 'Video', 'Image', 'Carousel', 'Tweet'
    views         INTEGER,
    likes         INTEGER,
    comments      INTEGER,
    excluded      BOOLEAN DEFAULT FALSE,  -- toggle to exclude from analytics
    posted_date   DATE,
    date_scraped  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (platform, shortcode)
)
```

---

## Scraper (main.py)

Runs as a Railway cron job at `0 4 * * *` (11pm EST).

**Instagram** — Apify actor `apify~instagram-scraper`
- Scrapes in two batches of accounts (50 posts per batch)
- Filters posts before per-account `start_date` (where set)
- Deduplicates via `ON CONFLICT (platform, shortcode) DO NOTHING`

**TikTok** — Apify actor `clockworks~free-tiktok-scraper`
- Currently: @inspirethecosmos for Cosmos only

**Twitter** — Apify actor `apidojo~tweet-scraper`
- Currently: @thecosmos for Cosmos only

**To add a new account**, edit the relevant list in `main.py`:
```python
INSTAGRAM_ACCOUNTS = [
    {"handle": "newhandle", "client": "ClientName", "account": "@newhandle", "start_date": "YYYY-MM-DD"},
]
```

**To run manually:**
```bash
railway run python3 main.py
```

**To backfill Wabi historical data:**
```bash
railway run python3 backfill_wabi.py
```
*(Requires Apify account to be active — will 403 if usage cap hit)*

---

## Dashboard (Next.js)

### Agency HQ (`/`)
- Animated count-up stats: Total Posts, Total Views, Total Likes
- Client cards with Posts, Views, Likes, CPI per client
- Hover glow on stat cards
- Links to each client's page

### Client Page (`/[client]`)
- **Client tabs**: Cosmos, Poke, Wabi, Yahoo, Olive
- **Platform tabs**: Overview, Instagram, TikTok (soon), Twitter (soon), ManyChat (soon)
- **All Time / This Month toggle**: switches stats, chart, and CPI
- **Stat cards**: Posts, Total Views, Total Likes, Avg Views
- **Views by Week chart**: weekly bar chart in pink
- **CPI card**: cost per impression (retainer × months active ÷ total views), with month-over-month arrow
- **Posts table**: sortable, with exclude/include toggle per post

### CPI Calculation
```
All Time CPI  = (monthly_retainer × months_tracked) ÷ total_views
This Month CPI = (retainer × days_elapsed/days_in_month) ÷ views_from_posts_this_month
```
Arrow (↓ green / ↑ red) compares current month vs previous month.

### Exclude Toggle
Each post has a pink/grey toggle. Excluded posts:
- Are faded out in the table
- Are removed from all stat calculations and charts
- Persist to the database via PATCH `/api/posts`

---

## Environment Variables

| Variable | Used by | Notes |
|----------|---------|-------|
| `DATABASE_URL` | Railway scraper + Vercel | Railway Postgres public URL |
| `APIFY_TOKEN` | Railway scraper | From apify.com → Settings → API tokens |

---

## Deployment

### Railway (scraper + database)
- Project: `content-analytics`
- Cron schedule: `0 4 * * *` (Settings → Cron Schedule on the scraper service)
- Deploy: `railway up` from repo root, or push to GitHub (auto-deploy if connected)

### Vercel (dashboard)
- Repo: `CC-Operations/analytics-scraper` (must be public for Hobby plan)
- Root directory: `dashboard`
- Env var: `DATABASE_URL` (Railway public URL, not internal)
- Auto-deploys on push to `main`

---

## Pending / Future Work

- [ ] Wabi historical backfill to Dec 24, 2025 (blocked on Apify upgrade)
- [ ] TikTok + Twitter for Poke, Wabi, Yahoo, Olive
- [ ] ManyChat integration
- [ ] CSV export per client
- [ ] Weekly Slack bot (Friday performance summary)
- [ ] Resolve CPI $0.6 formula from team case study
