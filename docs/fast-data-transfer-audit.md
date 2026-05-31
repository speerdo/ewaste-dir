# RecycleOldTech.com -- Fast Data Transfer Investigation

## Context

This is an Astro SSG site deployed on Vercel. The production URL is recycleoldtech.com.
The site is a directory of e-waste/electronics recycling locations organized by `/states/[state]/[city]/` routes.

## Observed Symptoms

From Vercel Observability (last 12 hours):

- Total outgoing transfer: ~30GB over 12 hours (~2.5GB/hour)
- Top city pages are generating **1.6MB to 2.4MB of transfer out per individual page request**
- Example: `/states/new-york/brooklyn/` -- 9 requests, 21.63MB out (~2.4MB/req)
- Example: `/states/idaho/moscow/` -- 12 requests, 18.9MB out (~1.6MB/req)
- Target: city pages should be well under 500KB total transfer per load

The issue appears mostly resolved but these per-request numbers are still high and need a root cause audit.

## Investigation Tasks

### 1. Compression Check

Run a curl against several high-traffic city routes and check response headers:

```bash
curl -sI https://recycleoldtech.com/states/new-york/brooklyn/ | grep -E 'content-encoding|content-length|content-type|cache-control|x-vercel-cache'
curl -sI https://recycleoldtech.com/states/idaho/moscow/ | grep -E 'content-encoding|content-length|content-type|cache-control|x-vercel-cache'
curl -sI https://recycleoldtech.com/states/florida/wildwood/ | grep -E 'content-encoding|content-length|content-type|cache-control|x-vercel-cache'
```

**What to look for:**

- `content-encoding: br` or `gzip` should be present -- if missing, compression is not working
- `x-vercel-cache: HIT` means the CDN cache is serving it -- `MISS` means it's hitting the origin every time
- `cache-control` should include `s-maxage` or `stale-while-revalidate` for static pages

### 2. Raw HTML Size

Check the actual size of the rendered HTML for a city page:

```bash
curl -s https://recycleoldtech.com/states/new-york/brooklyn/ | wc -c
curl -s --compressed https://recycleoldtech.com/states/new-york/brooklyn/ | wc -c
```

Compare uncompressed vs compressed byte counts. If uncompressed HTML is over 200KB, the page is likely embedding too much data inline (JSON blobs, full listing data, etc.).

### 3. JS Bundle Audit

Check the `_astro/` static assets directory for bundle sizes. In the project root:

```bash
# Check dist output sizes if available
find dist/_astro -name "*.js" | xargs ls -lh | sort -k5 -rh | head -20
find dist/_astro -name "*.css" | xargs ls -lh | sort -k5 -rh | head -10
```

Also check what scripts are being loaded on city pages by inspecting the built HTML:

```bash
grep -E '<script|<link rel="stylesheet"' dist/states/new-york/brooklyn/index.html | head -30
```

**What to look for:**

- Any JS bundle over 200KB (uncompressed) is a red flag
- Are client-side JS islands loading unnecessarily on mostly-static pages?
- Are there duplicate script tags?

### 4. Image Audit

Check what images are referenced in a city page:

```bash
grep -oE 'src="[^"]*\.(jpg|jpeg|png|webp|gif|svg)[^"]*"' dist/states/new-york/brooklyn/index.html
```

Also check if Astro's image optimization is configured:

```bash
cat astro.config.mjs | grep -A 10 -i image
```

**What to look for:**

- Are images using Astro's `<Image />` component (produces optimized, sized output)?
- Are there large unoptimized images being served directly from `/public`?
- Are Google Maps embeds or other heavy iframes present?

### 5. Inline Data Blobs

Check if listing data is being inlined into the HTML (common with SSG + large datasets):

```bash
grep -c '"lat"' dist/states/new-york/brooklyn/index.html
grep -c '"lng"' dist/states/new-york/brooklyn/index.html
# Check for large JSON script tags
grep -oE '<script type="application/json"[^>]*>(.{500,})</script>' dist/states/new-york/brooklyn/index.html | wc -c
```

### 6. vercel.json Headers Config

Check if compression or caching headers are misconfigured:

```bash
cat vercel.json
```

**What to look for:**

- Any `Cache-Control` headers that set `max-age=0` or `no-store` on static routes -- these would bust the CDN cache
- Missing or short `s-maxage` values on `/states/**` routes
- Any accidental disabling of compression

### 7. Astro Config Review

```bash
cat astro.config.mjs
```

**What to look for:**

- Is the output mode `static` or `hybrid`? Hybrid/server modes can bypass CDN caching
- Is `compressHTML` set to `false`? (it defaults to `true` but worth confirming)
- Are there any adapters or middleware that could be inflating responses?

### 8. AdSense / Third-Party Script Load

Check how many third-party scripts are being loaded per page:

```bash
grep -oE 'src="https://[^"]*"' dist/states/new-york/brooklyn/index.html
```

**What to look for:**

- AdSense (`pagead2.googlesyndication.com`) loading synchronously in `<head>` blocks render and inflates transfer accounting
- Google Maps JS API, analytics, or tag manager scripts that load additional payloads

---

## Investigation Results (May 31 2026)

### Bot protection status

Live curl tests confirm both `/claim` and all `/states/**` pages return:

```
HTTP/2 429
x-vercel-mitigated: challenge
cache-control: private, no-store, max-age=0
```

**Bot protection IS active.** The Vercel "challenge" mode is site-wide. Every non-browser request
gets a 33KB challenge page (Vercel's JS puzzle). After a real browser solves the puzzle once, it
gets a cookie and subsequent visits are served normally.

### The /claim problem (16K requests, 1.37GB in 6h)

- Challenge mode was enabled AFTER most of the 16K bot requests occurred (historical data)
- Going forward: 16K attempts × 33KB challenge page = ~528MB — still significant
- The challenge page contains an obfuscated JavaScript solver (~30KB minified) — Vercel controls this
- Bots using headless browsers (Playwright, Puppeteer) CAN solve the JS challenge automatically
- **Fix required in Vercel Dashboard**: change bot protection action from `challenge` → `deny` for `/claim`
  - `deny` returns a minimal 403 with near-zero body, not the 33KB challenge page
  - Path: Security → Firewall → Bot Protection → Add custom rule for path `/claim` with action `deny`
  - This is safe because `/claim` is a B2B lead form — only humans with real browsers should submit it

### City page transfer (1.7MB per request)

City pages like `/states/new-york/albany` generate ~1.7MB per cold page load
(7 requests × 11.9MB = that's challenge + actual page for each of 7 users, since Vercel
counts challenge bytes under the matched route too).

The actual page components contributing to size:
- **Hero image**: source files 800–900KB JPG → Astro outputs WebP at 1200×256 q=70 ≈ 200–400KB
- **Leaflet.js**: 145KB loaded dynamically (good) but CSS was loaded synchronously
- **CenterCard HTML**: 382-line component × N centers = significant HTML bulk for large cities
- **No center count limit**: `getRecyclingCentersByCity` returns ALL centers without a LIMIT,
  meaning large cities could render 100+ full-detail HTML cards

### JSON-LD schema

Already well-optimized: `SCHEMA_BUSINESS_LIMIT = 25`, descriptions truncated to 160 chars.

---

## Fixes Applied (May 31 2026 session)

### 1. Lazy-load Leaflet map — `src/components/MapComponent.astro`

Leaflet CSS is no longer loaded as a blocking `<link>` tag. Both the CSS and JS are now
injected dynamically via `IntersectionObserver` when the map container enters the viewport
(200px before it becomes visible). Users who don't scroll to the map save ~145KB of JS.

### 2. Reduce hero image size — `src/pages/states/[state]/[city].astro`

Changed from `width={1200} height={256} quality={70}` to `width={800} height={200} quality={60} format="webp"`.
Estimated saving: 100–200KB per cold page load (Astro converts at build time).

### 3. Cap city page HTML at 50 centers — `src/pages/states/[state]/[city].astro`

Added `MAX_VISIBLE_CENTERS = 50`. The HTML listing uses `visibleCenters` (first 50 centers).
Map markers still use the full `displayCenters` array so the interactive map remains complete.
A "Showing 50 of X" note is shown when the cap is hit.

---

## Remaining Dashboard Actions Required

These CANNOT be done via code — requires Vercel dashboard access:

### Critical: Change /claim protection from challenge → deny

1. Go to Vercel Dashboard → recycle-old-tech project → Security → Firewall
2. Under Bot Protection, add a **custom path rule**:
   - Path: `/claim`
   - Action: **Deny** (not Challenge)
3. This drops the per-request cost from 33KB (challenge HTML) to ~0.5KB (403 response)

### Verify rate limit uses "deny" not "challenge"

1. Go to Security → Firewall → Rate Limiting
2. Check the existing `/claim` rule — ensure the action is **Deny**, not Challenge
3. Current threshold should be ≤ 10 requests/minute per IP for /claim

### Enable AI bots managed rule

1. Go to Security → Firewall → Managed Rules
2. Enable **AI Bots** with action: **Deny**
3. This blocks known AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) site-wide
