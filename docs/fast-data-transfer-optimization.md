# Fast Data Transfer optimization tracker

Last updated: 2026-05-28  
Project: `recycle-old-tech` (Vercel) / [recycleoldtech.com](https://www.recycleoldtech.com)

This document tracks investigation and fixes for elevated **Fast Data Transfer** (outbound bandwidth from Vercel’s CDN). Use the Vercel dashboard **Usage → Networking** to validate trends after each deploy.

## Pre-push checklist

- [ ] `tv-recycling-guide.md` uses `broken-tv.jpeg` (not deleted `.png`)
- [ ] Vercel **production** env has `SITE_URL=https://www.recycleoldtech.com` (preview builds otherwise emit preview URLs in `sitemap-index.xml`)
- [ ] Run `npm run build` locally, confirm `dist/sitemap-index.xml` exists and locs use `www.recycleoldtech.com`
- [ ] After deploy: second `/api/news?...` request shows `x-vercel-cache: HIT` and `s-maxage` in `cache-control`

## How to verify after deploy

1. Vercel → Project → **Usage** → filter **Fast Data Transfer** (last 30 days).
2. Spot checks:
   - `/api/news?city=Austin&state=Texas` → repeat request: `x-vercel-cache: HIT`, `s-maxage=21600`
   - `/states/texas/austin` → HTML much smaller than ~2MB (current prod ~2MB before this deploy); `s-maxage=86400`
3. `/sitemap.xml` redirects to `sitemap-index.xml` (configured in `vercel.json`).

---

## Findings and status

| # | Issue | Impact | Status | Notes |
|---|--------|--------|--------|-------|
| 1 | `/api/news` uncached at edge (`x-vercel-cache: MISS`) | High — serverless + JSON on every city page view | **Done** | `s-maxage=21600` (6h), `stale-while-revalidate=43200` (12h), `max-age=3600` in API + `vercel.json` |
| 2 | City pages ~2MB HTML (Austin sample) | **Very high** — dominant FDT for crawlers/traffic | **Done (partial)** | JSON-LD used full `centers` (incl. nearby) with long descriptions; fixed to `displayCenters`, max 25, truncated descriptions |
| 3 | HTML CDN cache only 1h (`s-maxage=3600`) | Medium — repeat origin fetches | **Done** | `/states/*`, `/blog/*`, `/`, `*.html` → `s-maxage=86400`, SWR 7d |
| 4 | Dynamic `sitemap.xml.ts` (serverless, hits Supabase) | Medium — crawler/API cost | **Done** | Removed; `@astrojs/sitemap` + `filter(isCanonicalUrl)`; `robots.txt` → `sitemap-index.xml` |
| 5 | `broken-tv.png` 9.7MB in repo | Low–medium if served | **Done** | Deleted; blog uses `broken-tv.jpeg` |
| 6 | `default-og.png` 572KB | Medium (every OG/meta) | **Done** | Compressed to ~47KB via sharp |
| 7 | Duplicate `public/images` + `src/assets/images` (~18MB + 43MB) | Medium if `/images/*` referenced | **Open** | Astro `<Image>` optimizes assets; many legacy copies in `public/images/` still served as-is |
| 8 | ~3,970 static city pages × HTML/JS | Baseline FDT | **Ongoing** | Mitigated by #2–3; monitor crawl volume in GSC |
| 9 | 1,449 redirects in `vercel.json` | Low per hit | **Open** | Keep lean; audit only if redirect traffic shows in logs |
| 10 | Bot/crawler traffic | Variable | **Open** | Consider Vercel Firewall / Bot Protection if Usage shows bot spikes |
| 11 | Other `/api/*` routes | Low unless heavily used | **Open** | `submit-claim`, `search/suggestions`, admin, etc. — not changed |
| 12 | Leaflet/OSM/Google Fonts (external) | N/A for Vercel FDT | **N/A** | Third-party; no Vercel bandwidth |

---

## Changes shipped (2026-05-28)

### News API caching (regular refresh + edge cache)

- **`src/lib/cache-control.ts`** — shared cache header constants.
- **`src/pages/api/news.ts`** — `s-maxage=21600`, SWR 12h; `CDN-Cache-Control` mirror; `fetchedAt` in JSON; errors use `no-store`.
- **`vercel.json`** — matching headers for `/api/news`.

News still refreshes at most every **6 hours** per city/state at the edge (stale up to 12h while revalidating). Browsers may cache 1h (`max-age=3600`).

### City page size

- **`src/utils/localBusinessSchema.ts`** — compact JSON-LD (displayed centers only, max 25, descriptions ≤160 chars).
- **`src/pages/states/[state]/[city].astro`** — schema uses `displayCenters` instead of full `centers`; removed unused opening-hours helpers.

### CDN / sitemap / assets

- **`vercel.json`** — longer HTML cache headers.
- **Removed `src/pages/sitemap.xml.ts`** — static sitemap via `@astrojs/sitemap`.
- **`astro.config.mjs`** — `filter` + `serialize` canonical URL checks.
- **`public/robots.txt`** — `sitemap-index.xml`.
- **`public/images/default-og.png`** — recompressed.
- **`src/components/LocalNews.astro`** — removed debug logging; simpler errors.

---

## Recommended next steps

1. **Deploy** and confirm Usage trend over 1–2 weeks.
2. **Batch-compress `public/images/`** (WebP, max width 1600) or migrate references to Astro assets only.
3. **Redirect** `/sitemap.xml` → `/sitemap-index.xml` if GSC reports 404 on old sitemap URL.
4. **Vercel Observability** — top paths by bandwidth if available on your plan.
5. **Optional:** self-host Leaflet on `/_astro` or `/assets` (small FDT win; mostly third-party today).

---

## Cache policy reference

| Resource | Edge (`s-maxage`) | Stale-while-revalidate | Browser (`max-age`) |
|----------|-------------------|------------------------|---------------------|
| `/api/news` | 6 hours | 12 hours | 1 hour |
| City/state/blog HTML | 24 hours | 7 days | 1 hour |
| `/_astro`, `/assets`, `/images` | 1 year (immutable) | — | 1 year |
