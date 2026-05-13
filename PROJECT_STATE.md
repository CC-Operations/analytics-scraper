# Analytics Dashboard — Project State

Last updated: 2026-05-13

## Current Status

### Infrastructure
- [x] Railway project: `content-analytics`
- [x] Railway Postgres: `analytics-db` (Online)
- [x] Python scraper deployed on Railway (via `railway up`)
- [x] GitHub repo: `CC-Operations/analytics-scraper`
- [ ] Railway auto-deploy from GitHub (needs repo reconnected in Railway Settings → Source)
- [ ] Cron schedule set in Railway (target: `0 4 * * *` = 11pm EST)

### Data Pipeline
- [x] Instagram scraper (Apify `apify/instagram-scraper`)
- [x] Writes to Postgres `posts` table
- [x] Deduplication by shortcode
- [x] Per-account start date filtering (Cosmos + Yahoo: 2026-05-13)
- [ ] TikTok scraper
- [ ] Twitter/X scraper
- [ ] ManyChat integration

### Dashboard
- [ ] Next.js app scaffolded
- [ ] Deployed to Vercel
- [ ] Per-client tabs (Cosmos, Poke, Wabi, Yahoo)
- [ ] Per-platform sections (Instagram, TikTok, Twitter, ManyChat)

---

## Accounts

| Client | Handle | Platform | Start Date |
|--------|--------|----------|------------|
| Cosmos | @cosmos | Instagram | 2026-05-13 |
| Poke | @poke | Instagram | — |
| Wabi | @wabimaxxing | Instagram | — |
| Wabi | @gotwabi | Instagram | — |
| Wabi | @finthetourist | Instagram | — |
| Yahoo | @yahoo | Instagram | 2026-05-13 |

---

## Database Schema (Postgres)

```sql
posts (
    id SERIAL PRIMARY KEY,
    client TEXT,
    account TEXT,
    platform TEXT,         -- 'instagram', 'tiktok', 'twitter'
    shortcode TEXT UNIQUE,
    post_url TEXT,
    caption TEXT,
    post_type TEXT,        -- 'Video', 'Image', 'Sidecar'
    views INTEGER,
    likes INTEGER,
    comments INTEGER,
    posted_date DATE,
    date_scraped TIMESTAMPTZ
)
```

---

## Environment Variables

| Variable | Service | Notes |
|----------|---------|-------|
| `DATABASE_URL` | Railway scraper + Vercel | Auto-provided by Railway Postgres |
| `APIFY_TOKEN` | Railway scraper | From Apify account |
| `NOTION_TOKEN` | (legacy) | Can be removed |
| `NOTION_DATABASE_ID` | (legacy) | Can be removed |

---

## Next Steps

1. Fix Railway GitHub auto-deploy (reconnect to `CC-Operations/analytics-scraper`)
2. Set cron schedule: Railway → apify-analytics-scraper → Settings → `0 4 * * *`
3. Build Next.js dashboard (see BUILD_GUIDE.md Phase 6)
4. Add TikTok scraper (BUILD_GUIDE.md Phase 3)
5. Add Twitter scraper (BUILD_GUIDE.md Phase 4)
6. Add ManyChat integration (BUILD_GUIDE.md Phase 5)
