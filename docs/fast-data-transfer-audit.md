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

## Expected Findings / Hypothesis Priority

1. **Most likely:** Pages are not being served from Vercel CDN cache (`x-vercel-cache: MISS`) and are hitting the origin on every request, compounding transfer
2. **Second most likely:** Large unoptimized images or a heavy JS bundle from an Astro island (map componeasnt, search widget, etc.)
3. **Less likely but possible:** Inline JSON data blob embedded in SSG HTML output is bloating raw page size

## Output Format

Please report back with:

- Actual `content-encoding` and `x-vercel-cache` header values from the curl checks
- Raw uncompressed and compressed HTML byte counts for at least 2 city pages
- Top 5 JS bundles by size from `dist/_astro`
- Whether `compressHTML` is enabled in astro config
- Contents of `vercel.json` (or note if it doesn't exist)
- Any images found that are NOT going through Astro's image optimizer
