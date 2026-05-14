# Analytics Dashboard — Project State

Last updated: 2026-05-13

---

## ✅ Done

### Infrastructure
- [x] Railway Pro project: `content-analytics`
- [x] Railway Postgres: `analytics-db` (online)
- [x] Python scraper deployed on Railway
- [x] Cron schedule: `0 4 * * *` (11pm EST)
- [x] GitHub repo: `CC-Operations/analytics-scraper` (public)
- [x] Next.js dashboard deployed on Vercel
- [x] Vercel auto-deploys on push to `main`

### Scraper
- [x] Instagram scraper (Apify `apify~instagram-scraper`)
- [x] TikTok scraper — Cosmos only (@inspirethecosmos)
- [x] Twitter scraper — Cosmos only (@thecosmos)
- [x] Deduplication via `UNIQUE (platform, shortcode)`
- [x] Per-account start date filtering
- [x] `excluded` column + PATCH API for toggle
- [x] resultsLimit: 50 per batch (nightly)
- [x] Sidecar → Carousel normalization in POST_TYPE_MAP

### Dashboard
- [x] Agency HQ homepage with animated stats + client cards
- [x] Per-client pages: Cosmos, Poke, Wabi, Yahoo, Olive
- [x] Platform tabs (Instagram active; TikTok/Twitter/ManyChat shown as "soon")
- [x] All Time / This Month toggle
- [x] Views by Week bar chart (weekly aggregation)
- [x] CPI stat card with ↓/↑ trend arrow (month-over-month)
- [x] Posts table with exclude/include toggle per post
- [x] Post type badges (Video, Image, Carousel, Tweet)
- [x] Platform colored dots
- [x] HQ client cards show Posts, Views, Likes, CPI
- [x] Hover glow on HQ stat cards

### Clients
- [x] Cosmos — Instagram (@cosmos), TikTok (@inspirethecosmos), Twitter (@thecosmos)
- [x] Poke — Instagram (@poke)
- [x] Wabi — Instagram (@wabimaxxing, @gotwabi, @finthetourist)
- [x] Yahoo — Instagram (@yahoo)
- [x] Olive — Instagram (@oliveapp, data from 2026-02-15)

---

## 🔴 Blocked

- [ ] **Wabi IG backfill to 2025-12-24** — `backfill_wabi.py` is written and ready, blocked on Apify $5 cap. Run once Apify Starter plan is active: `railway run python3 backfill_wabi.py`
- [ ] **TikTok + Twitter** — 403ing due to same Apify cap. Will resume automatically after upgrade.

---

## 📋 Pending

### Near-term
- [ ] Upgrade Apify to Starter ($49/mo) to unblock scrapers
- [ ] Run Wabi backfill after Apify upgrade
- [ ] Clarify CPI $0.6 formula from team case study (what was the denominator?)
- [ ] Add Twitter accounts for other clients (Poke, Wabi, Yahoo, Olive)
- [ ] Add TikTok accounts for other clients

### Future
- [ ] CSV export button per client
- [ ] Weekly Slack bot — Friday morning performance summary
- [ ] ManyChat integration (subscriber growth + flow conversions)
- [ ] ManyChat tab on client pages

---

## Accounts

| Client | Handle | Platform | Start Date | Retainer |
|--------|--------|----------|------------|----------|
| Cosmos | @cosmos | Instagram | 2026-05-13 | $40,000/mo |
| Cosmos | @inspirethecosmos | TikTok | 2026-05-13 | — |
| Cosmos | @thecosmos | Twitter | 2026-05-13 | — |
| Poke | @poke | Instagram | — | $35,000/mo |
| Wabi | @wabimaxxing | Instagram | — | $35,000/mo |
| Wabi | @gotwabi | Instagram | — | — |
| Wabi | @finthetourist | Instagram | — | — |
| Yahoo | @yahoo | Instagram | 2026-05-13 | — |
| Olive | @oliveapp | Instagram | 2026-02-15 | $15,000/mo |

---

## Monthly Costs

| Service | Plan | Cost |
|---------|------|------|
| Railway | Pro | $20/mo |
| Apify | Starter (upgrade pending) | $49/mo |
| Vercel | Hobby | Free |
| GitHub | Free (public repo) | Free |
| **Total (dashboard only)** | | **$69/mo** |

---

## Key Files

| File | Purpose |
|------|---------|
| `main.py` | Nightly scraper — edit to add accounts |
| `backfill_wabi.py` | One-off Wabi historical backfill |
| `dashboard/app/page.tsx` | Agency HQ homepage |
| `dashboard/app/[client]/page.tsx` | Per-client dashboard |
| `dashboard/app/api/posts/route.ts` | Posts API (GET + PATCH) |
| `dashboard/app/api/overview/route.ts` | Aggregated HQ stats API |
| `dashboard/lib/db.ts` | Postgres connection |
