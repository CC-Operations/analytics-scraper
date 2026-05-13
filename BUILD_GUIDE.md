# Creator Camp Analytics Dashboard — Build Guide

## What We're Building
A multi-client analytics dashboard for Creator Camp that:
- Scrapes Instagram, TikTok, and Twitter nightly via Apify
- Pulls ManyChat conversion data
- Stores everything in a Postgres database on Railway
- Displays in a Next.js dashboard on Vercel with per-client tabs

---

## Architecture

```
Apify (Instagram / TikTok / Twitter)
ManyChat API
        ↓
Railway Python Scrapers (cron, nightly)
        ↓
Railway Postgres (analytics-db)
        ↓
Vercel Next.js Dashboard
```

---

## Clients & Platforms

| Client | Instagram | TikTok | Twitter | ManyChat |
|--------|-----------|--------|---------|----------|
| Cosmos | @cosmos | TBD | TBD | ✓ |
| Poke | @poke | — | — | — |
| Wabi | @wabimaxxing, @gotwabi, @finthetourist | — | — | — |
| Yahoo | @yahoo | TBD | TBD | — |

---

## Phase 1: Railway Postgres Setup ✅ (do this first)

1. Go to your Railway `content-analytics` project
2. Click **+ New → Database → PostgreSQL**
3. Name it `analytics-db`
4. Click the Postgres service → **Connect** tab → copy `DATABASE_URL`
5. Add `DATABASE_URL` as an environment variable on your Python scraper service
   - Railway auto-injects it if both services are in the same project — verify it's there

---

## Phase 2: Update Instagram Scraper to Write to Postgres

**File:** `main.py`

Changes:
- Add `psycopg2-binary` to `requirements.txt`
- On startup, create the `posts` table if it doesn't exist
- Replace Notion writes with Postgres inserts
- Keep deduplication logic (check shortcode before inserting)

**Posts table schema:**
```sql
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
```

---

## Phase 3: Add TikTok Scraper

**Apify actor:** `clockworks/free-tiktok-scraper`

Input format:
```json
{
  "profiles": ["https://www.tiktok.com/@<handle>"],
  "resultsPerPage": 20
}
```

Fields to extract: `id`, `webVideoUrl`, `text` (caption), `playCount`, `diggCount` (likes), `commentCount`, `createTime`, `authorMeta.name`

Map to posts table: platform = `tiktok`

---

## Phase 4: Add Twitter/X Scraper

**Apify actor:** `apidojo/tweet-scraper` or `quacker/twitter-scraper`

Input format:
```json
{
  "startUrls": ["https://twitter.com/<handle>"],
  "maxItems": 20
}
```

Fields to extract: `id`, `url`, `text`, `retweetCount`, `likeCount`, `replyCount`, `createdAt`, `author.userName`

Map to posts table: platform = `twitter`, views = impressions if available

---

## Phase 5: Add ManyChat Integration

**ManyChat API docs:** https://api.manychat.com

Pull subscriber growth and flow conversion data daily.

**Conversions table schema:**
```sql
CREATE TABLE IF NOT EXISTS conversions (
    id SERIAL PRIMARY KEY,
    client TEXT,
    platform TEXT DEFAULT 'manychat',
    event_type TEXT,
    count INTEGER,
    date DATE,
    date_scraped TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 6: Build Next.js Dashboard on Vercel

### Setup
```bash
npx create-next-app@latest analytics-dashboard
cd analytics-dashboard
npm install @vercel/postgres recharts lucide-react
```

### Page structure
```
/app
  /page.tsx              → redirects to /cosmos
  /[client]/page.tsx     → per-client dashboard
  /api/posts/route.ts    → fetches posts from Postgres
  /api/conversions/route.ts
```

### Client tabs
- Cosmos
- Poke
- Wabi
- Yahoo

### Per-client sections
- **Overview**: total posts, total views, total likes this month
- **Instagram**: table of recent posts with views/likes/comments
- **TikTok**: table of recent posts
- **Twitter**: table of recent posts
- **ManyChat**: conversion counts by flow

### Deploy to Vercel
1. Push Next.js app to a new GitHub repo
2. Connect repo to Vercel
3. Add `DATABASE_URL` (from Railway) as a Vercel environment variable
4. Deploy

---

## Environment Variables

| Variable | Used by | Value |
|----------|---------|-------|
| `NOTION_TOKEN` | Railway scraper | from Notion integration |
| `NOTION_DATABASE_ID` | Railway scraper | `e28bd1e2c1794574816fde368553c71a` |
| `APIFY_TOKEN` | Railway scraper | from Apify account |
| `DATABASE_URL` | Railway scraper + Vercel | from Railway Postgres |
| `MANYCHAT_TOKEN` | Railway scraper | from ManyChat account |

---

## Railway Cron Schedule

Set on each scraper service under **Settings → Cron Schedule**:
- Instagram: `0 4 * * *` (11pm EST)
- TikTok: `0 4 * * *`
- Twitter: `0 4 * * *`
- ManyChat: `0 4 * * *`

---

## Current Status

- [x] Instagram scraper running on Railway
- [x] Writing to Notion
- [ ] Add Postgres to Railway (Phase 1)
- [ ] Migrate Instagram scraper to Postgres (Phase 2)
- [ ] Add TikTok scraper (Phase 3)
- [ ] Add Twitter scraper (Phase 4)
- [ ] Add ManyChat integration (Phase 5)
- [ ] Build Next.js dashboard (Phase 6)
- [ ] Deploy to Vercel (Phase 6)
