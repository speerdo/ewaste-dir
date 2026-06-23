# SEO Growth Plan — RecycleOldTech

**Date:** 2026-06-23
**Author:** Generated from Ahrefs (project 8362376) + Google Search Console data, cross-referenced with recent git history.
**Goal:** Reverse the May–June traffic/AdSense decline and return to the Jan→Apr growth trajectory.

---

## 1. Where we actually are (the data)

### Google Search Console — real Google traffic (monthly)

| Month | Clicks | Impressions | CTR | Avg position |
|-------|-------:|------------:|----:|-------------:|
| Jan 2026 | 626 | 55,604 | 1.13% | 18.0 |
| Feb 2026 | 708 | 75,058 | 0.94% | 16.2 |
| Mar 2026 | 973 | 92,793 | 1.05% | 13.6 |
| **Apr 2026** | **1,023** | **102,082** | 1.00% | **11.4** ← peak |
| May 2026 | 867 | 91,492 | 0.95% | 14.5 |
| Jun 2026 (partial) | 602 | 66,358 | 0.91% | 13.8 |

**Read:** We climbed steadily Jan→Apr (clicks +63%, average position improved from 18 → 11.4). The peak was **April**. May and June both gave ground — impressions down ~35% from the April peak and average position slipped ~3 spots. This is the "flat or down" the AdSense revenue reflects (impressions ≈ ad inventory).

**The shape of the decline matters:** impressions stayed high (~91k) in May while *position* worsened, then impressions fell in June. That pattern is a **ranking demotion** (we got pushed down the page / page 2), **not** a deindexing/crawl block. If pages had fallen out of the index, impressions would have collapsed, not drifted. This rules out the recent caching/header changes as the primary cause (verified: `noindex` is correctly scoped to `/admin` and `/claim` only; `robots.txt` is clean).

### What the recent commits actually did

Almost all recent work was **performance/infrastructure**, not traffic generation:

- `f3abd79`, `1c61185`, `d263fff` — PageSpeed fixes (Hero, FeaturedStates, Layout, url-utils)
- `4e3141a`, `747efdb`, `72f6443`, `8e16258`, `b8f6ec3`, `a54af58`, `b363339` — "fast data transfer" reduction: cache the news API, local Leaflet.js, image cache-control, claim-page caching
- `b7e6d12`, `4403543` — redirects for removed/missing city pages (good — prevents 404s)
- `a61aaca`, `189baef`, `dc57690`, `2e42103` — new blog posts (trade-in, TV recycling, donation, certifications)
- `d263fff` — **the sitemap bug fix** (see below)

**Verdict:** This work is *good hygiene* (faster pages help Core Web Vitals and lower Vercel cost) but none of it targets rankings or new keywords. The decline is almost certainly **algorithmic/competitive** (a Google update and/or competitors outranking us on page-2 terms) layered on top of a real sitemap bug. The path back to growth is **content + on-page optimization on the keywords we already almost rank for**, plus fixing discovery.

### The one real bug found: sitemap was emitting the wrong domain

`astro.config.mjs` derived `SITE_URL` from `VERCEL_URL`, which Vercel sets on **every** build including production. So in production the sitemap/canonical base could resolve to a `*.vercel.app` preview URL instead of `https://www.recycleoldtech.com`. Fixed in `d263fff` by gating on `VERCEL_ENV !== 'production'`. **This fix must be deployed and the sitemap resubmitted** — see P0 below.

---

## 2. The opportunity (Ahrefs organic keywords)

We have a **large pool of striking-distance keywords** — already ranking, just on page 2/3. Moving these to page 1 is the fastest, lowest-risk growth lever. Highlights:

| Keyword | Volume | KD | Current pos | Ranking URL |
|---------|-------:|---:|------------:|-------------|
| electronic recycling center | 2,000 | **5** | 35 | /states/colorado |
| laptop trade in | 2,700 | 15 | 30 | /trade-in |
| trade in laptop | 1,300 | **4** | 44 | /trade-in |
| tech recycling | 1,200 | 47 | 21 | /states/colorado |
| electronic recycle | 1,100 | 18 | 20 | /states/colorado |
| certified electronics recycling | 400 | 15 | 19 | /states/colorado |
| does best buy take old tvs | 800 | 15 | 23 | /blog/best-buy-vs-staples-vs-ecoatm |
| best buy printer recycling | 600 | 29 | 21 | /blog/best-buy-vs-staples-vs-ecoatm |
| new caney recycling | 500 | 0 | 16 | /states/texas/new-caney |
| staples recycle electronics | 450 | 2 | 32 | /blog/best-buy-vs-staples-vs-ecoatm |

Plus **dozens of local city pages ranking positions 7–12** for KD-0 local terms (priest recycling, bloomsburg recycling center, cockeysville landfill, sioux falls electronic recycling, etc.). Individually small; collectively this long tail is the backbone of the site's traffic.

### Two structural problems this reveals

1. **A state page is accidentally ranking for national head terms.** `/states/colorado` is our best page for *"electronic recycling center"* (2,000), *"tech recycling"* (1,200), *"electronic recycle"* (1,100), *"certified electronics recycling"* (400). Google is grabbing a state page because **we have no dedicated national/topic landing page** for these high-volume generic terms. A purpose-built pillar page will almost always beat a tangential state page. **This is the single biggest missed opportunity.**

2. **The trade-in page underperforms its keywords.** `/trade-in` sits at pos 30–44 for *"laptop trade in"* (2,700, KD 15) and *"trade in laptop"* (1,300, KD 4) — extremely low difficulty. The page is currently a thin Amazon-affiliate explainer. With proper on-page targeting and depth it should reach page 1.

---

## 3. Action plan (prioritized)

### P0 — Fix discovery & confirm the foundation (this week)

1. **Deploy the sitemap fix and resubmit.** Confirm `d263fff` is in production. Then:
   - Fetch `https://www.recycleoldtech.com/sitemap-index.xml` in production and verify **every** URL uses `https://www.recycleoldtech.com` (no `vercel.app`).
   - In Google Search Console → Sitemaps, remove and re-add `sitemap-index.xml` to force a re-read.
   - Run `npm run submit:indexnow` to re-ping IndexNow (the audit showed the IndexNow queue dropped by 758 pages — worth confirming those were intentional removals, not accidental drops).
2. **Audit-confirm the redirects.** The audit flagged 2 new 404/4XX internal pages and "Pages dropped from Top 10" (15 pages, +5). Crawl the site (or check GSC → Pages → Not indexed) and ensure removed city pages 301 to a relevant live page (state hub or nearest city), not to the homepage.
3. **Check for a Google algorithm update overlapping early May.** If the position drop aligns with a known core/spam update, the fix is content quality (below), not a technical bug. Note the date in GSC for future reference.

### P1 — Capture the high-volume head terms (next 2–4 weeks)

4. **Build national pillar/hub pages** so we stop relying on `/states/colorado` for generic terms. Create (or substantially upgrade) dedicated, in-depth pages:
   - `/electronics-recycling` (or strengthen the homepage) targeting **"electronic recycling center"** (2,000, KD 5), **"electronic recycle"** (1,100), **"tech recycling"** (1,200), **"certified electronics recycling"** (400). Include: what counts as e-waste, how to find a certified (R2/e-Stewards) recycler, a "find a center near you" entry into the states/cities directory, FAQs with FAQ schema.
   - Internally link this pillar from the homepage nav and from every state/city page ("Looking for certified electronics recycling? Start here"). This concentrates internal PageRank on the page we *want* to rank.
5. **Rebuild the `/trade-in` page around its keywords.** Target **"laptop trade in"** (2,700) and **"trade in laptop"** (1,300, KD 4):
   - Work the exact phrases into the `<title>`, `<h1>`, and first paragraph (current title is generic "Trade In Your Old Electronics for Cash").
   - Add a device-specific section/table for laptops (brands, rough value ranges, condition tiers), plus phone/tablet/console sections.
   - Add comparison + FAQ content so it's not a thin affiliate page; add FAQ/HowTo schema.
   - Keep the Amazon affiliate CTA but earn the ranking with unique, useful content.
6. **Strengthen the comparison blog** (`/blog/best-buy-vs-staples-vs-ecoatm`) — already ranking pos 11–23 for *"does best buy take old tvs"* (800), *"best buy printer recycling"* (600), *"staples recycle electronics"* (450). Expand each retailer section, add a current pricing/policy table, refresh the date, add internal links to `/trade-in` and the recycling pillar. This page is one optimization pass from multiple page-1 positions.

### P2 — Scale the long-tail directory (ongoing)

7. **Push page-1-adjacent city pages over the line.** Many cities sit at positions 7–12 (e.g. new-caney pos 16/500vol, cockeysville, bloomsburg, kennesaw pos 12/150vol). For the highest-volume of these:
   - Ensure each has a unique, locally-specific intro (hours, accepted items, nearby alternatives) — not boilerplate. The audit flagged 17 pages with "high AI content levels"; differentiate them with real local data.
   - Add internal links between nearby cities and up to the state hub.
   - Confirm each is in the sitemap with priority 0.9 (already configured) and indexed.
8. **Internal linking pass site-wide.** The strongest lever for a large directory. From high-authority pages (homepage, state hubs, the new pillar) link down to money pages and key city pages with descriptive anchor text. Add "related nearby centers" modules on city pages.
9. **Content cadence.** Keep shipping blog posts, but target *keywords we can verify demand for* (use Ahrefs Keywords Explorer before writing). Prioritize "does [retailer] take [item]", "where to recycle [item]", and "[item] recycling near me" patterns — they match our directory intent and have proven volume.

### P2+ — Off-page (slower, compounding)

10. **Referring domains.** The audit noted referring domains dropped. A handful of quality links (local-gov recycling pages, "best e-waste resources" roundups, supplier/partner sites) would lift the whole domain. Low KD on our targets means even modest link growth moves rankings.

---

## 4. What to measure (check in 4 weeks)

- **GSC impressions & average position** — leading indicators. Want impressions climbing back toward 100k and average position back under 12.
- **Striking-distance count** — number of keywords in positions 4–15 (Ahrefs). Want this growing.
- **The five named target keywords** (electronic recycling center, laptop trade in, trade in laptop, tech recycling, electronic recycle) — track weekly position on the pillar/trade-in pages.
- **AdSense impressions** should track GSC impressions with a short lag.

## 5. What NOT to do

- **Do not** change the Vercel adapter or `output` mode in `astro.config.mjs` (per project memory — it stays as configured).
- **Do not** roll back the performance/caching work to "fix" traffic — it isn't the cause, and the speed gains help Core Web Vitals.
- **Do not** mass-generate more thin city/blog pages; the audit already flags AI-content and low-word-count risk. Depth and differentiation beat volume now.

---

### TL;DR
The recent commits were solid performance hygiene plus one real sitemap-domain bug fix — none of it grows traffic, and none of it caused the decline. The decline is an algorithmic/competitive ranking slip from the April peak. **Fastest path back to growth:** (1) deploy + resubmit the corrected sitemap, (2) build a national "electronics recycling" pillar page so we stop leaning on `/states/colorado` for 1,000–2,000-volume head terms, (3) rebuild `/trade-in` around "laptop trade in" (2,700 vol, KD 15), and (4) push the many city pages sitting at positions 7–12 onto page 1 with unique local content and internal links.
