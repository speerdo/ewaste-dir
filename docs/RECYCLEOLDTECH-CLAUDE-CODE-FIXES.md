# RecycleOldTech.com — Claude Code Fix Prompt
## Generated: June 17, 2026 | Source: Ahrefs MCP + Live Site Audit

This document contains a prioritized list of issues discovered via Ahrefs site audit, live page inspection via Vercel MCP, and keyword analysis. Some fixes are code changes in the `ewaste-dir` repo. Others require Supabase database updates. Each issue is labeled accordingly.

---

## Context

- **Repo**: `ewaste-dir` (Astro SSG, Supabase, Vercel, Tailwind)
- **Framework**: Astro v6.1.3
- **Stack**: Astro pages pull data from Supabase at build time for city/state pages
- **Deployment**: Vercel (project: `recycle-old-tech`, team: `creative-bandit-projects`)
- **Site audit project ID**: `8362376` (Ahrefs)
- **Health score**: 100 but with 16 errors and 63 warnings

---

## Priority 1: Title Tags Too Long (32 pages) — CODE FIX

**Issue**: Ahrefs site audit flags 32 pages with title tags exceeding ~60 characters. Google truncates these in SERPs, reducing click-through rate. From inspecting a live city page (Phoenix, AZ), the title pattern is:

```
Phoenix E-Waste Recycling Centers & Services - 39 Locations
```

That's 59 characters — borderline. Longer city names or higher counts push it over. The issue is primarily in the city page title template.

**What to fix**: Find the Astro component or page that generates the `<title>` tag for city pages (likely `src/pages/states/[state]/[city].astro` or a layout component) and tighten the title formula.

**Current pattern** (reconstructed from live pages):
```
{City} E-Waste Recycling Centers & Services - {N} Locations
```

**Proposed pattern** (max ~55 chars):
```
E-Waste Recycling in {City}, {StateAbbr} | {N} Centers
```

Example: `E-Waste Recycling in Phoenix, AZ | 39 Centers` = 46 chars ✓

For state pages, the current pattern is likely:
```
Electronics Recycling Centers in {State} - E-Waste Directory
```
Which can exceed 60 chars for long state names. Shorten to:
```
E-Waste Recycling in {State} | RecycleOldTech
```

**Files to check**:
- `src/pages/states/[state]/[city].astro`
- `src/pages/states/[state].astro`
- Any shared `<Layout>` or `<SEO>` component that constructs title tags
- `src/layouts/Layout.astro` (or similar)

**Implementation notes**:
- The state abbreviation mapping (e.g., Arizona → AZ) may need a small lookup object if not already present
- Do not change the H1 — only the `<title>` tag and `og:title` meta tag
- The meta description is separate — do not change it here

---

## Priority 2: Meta Descriptions Too Long (10 pages) — CODE FIX

**Issue**: 10 pages have meta descriptions exceeding ~160 characters. Google rewrites these, which can dilute your messaging.

From inspecting the Phoenix page, the description is:
```
Find 39 certified electronics recycling centers in Phoenix. Safe e-waste disposal for phones, computers, TVs and more in Phoenix.
```
That's 130 chars — fine. But some city pages with longer descriptions or more content push over 160.

**What to fix**: Audit the meta description template in the city and state page components. Ensure no generated description exceeds 155 characters.

**Proposed city description formula**:
```
Find {N} certified electronics recycling centers in {City}, {State}. Drop off phones, computers, TVs, and more for free or low cost.
```
Keep this under 155 chars. If `{N}` is very high or city/state names are long, truncate to:
```
Find certified e-waste recyclers near {City}, {State}. Safe drop-off for phones, computers, TVs, and more.
```

**Files to check**: Same as Priority 1 — the title/meta generation logic is usually co-located.

---

## Priority 3: HTTPS Page Links to HTTP Image (2 pages) — CODE FIX

**Issue**: Ahrefs flags 2 pages serving images over HTTP rather than HTTPS, creating mixed content warnings. These are likely hardcoded `http://` image URLs in either the Astro templates or in database-stored business data.

**What to fix**:

Step 1 — Search the codebase for any hardcoded `http://` image src attributes:
```bash
grep -r 'src="http://' src/
grep -r "src='http://" src/
```

Step 2 — If not found in code, the URLs are coming from the database. Run a Supabase query to find and fix them:
```sql
-- Find recycling centers with HTTP image URLs
SELECT id, name, photo_url
FROM recycling_centers
WHERE photo_url LIKE 'http://%'
LIMIT 50;

-- Fix: update to HTTPS
UPDATE recycling_centers
SET photo_url = REPLACE(photo_url, 'http://', 'https://')
WHERE photo_url LIKE 'http://%';
```

Also check the `verified_partners` table:
```sql
UPDATE verified_partners
SET logo_url = REPLACE(logo_url, 'http://', 'https://')
WHERE logo_url LIKE 'http://%';
```

**Note**: The Google Places photo URLs (lh3.googleusercontent.com) seen in the live Phoenix page are already HTTPS. The flagged HTTP images are likely legacy records from before the pipeline enforced HTTPS.

---

## Priority 4: One New 404 Page — CODE OR DB FIX

**Issue**: The site audit shows 1 new 404 page added since the last crawl (change: +1). This is a new broken internal link that appeared recently.

**What to fix**:

Step 1 — Run the Ahrefs site audit page explorer to find the specific URL (or check Vercel logs filtered by 404 status).

Step 2 — In Vercel dashboard: Logs → filter by status `404` → look for the new URL that started appearing.

Step 3 — Add a redirect for it in `vercel.json` if it is a renamed page, or fix the internal link pointing to it in the Astro templates.

The most likely cause is a blog post slug that changed, or a state/city URL that was renamed during a data cleanup.

---

## Priority 5: Page 2 Keywords — Content + Internal Linking Fix

**Issue**: 17 keywords are sitting in positions 11–20 (page 2). These are the highest-leverage SEO opportunity. From Ahrefs organic keyword data, the key ones include:

| Keyword | Volume | Position | Ranking URL |
|---------|--------|----------|-------------|
| where to dispose of electronics near me | 350 | ~18 | state page |
| e waste drop off | 350 | ~19 | state page |
| disposal of electronics near me | 250 | ~22 | state page |
| electronic disposal | 1,000 | 21 | /states/colorado |
| electronic recycle | 1,100 | 20 | /states/colorado |
| certified electronics recycling | 400 | 19 | /states/colorado |
| new caney recycling | 500 | 16 | /states/texas/new-caney |
| does staples take old tvs | 100 | 11 | /blog/best-buy-vs-staples-vs-ecoatm |

**What to fix**:

**For city/state pages ranking on page 2**: Add stronger internal links from the homepage and other high-traffic pages pointing to the specific state pages that are close to page 1. The Colorado state page in particular is ranking for multiple high-volume terms — it deserves more internal link equity.

In `src/pages/index.astro` (homepage), the "Popular States" section currently shows California, Florida, New York. **Add Colorado** as a fourth featured state, or add it to the "Popular Cities" section as Denver.

**For the blog post** (`/blog/best-buy-vs-staples-vs-ecoatm`) ranking for "does staples take old tvs": Add an internal link from this post to the new TV recycling guide post (`/blog/tv-recycling-guide`) to consolidate TV-related authority.

**For Colorado specifically**: The `/states/colorado` page ranks for 3 high-volume page-2 terms. Check that page for:
- Thin content — add a short intro paragraph mentioning e-waste disposal, electronic recycling, and certified facilities
- Internal links from other pages — make sure the homepage and states index link to Colorado
- Schema markup — ensure LocalBusiness or ItemList schema is present

---

## Priority 6: 486 Pages to Submit to IndexNow — CODE FIX

**Issue**: Ahrefs flags 486 pages as needing IndexNow submission. These are pages that exist and are indexable but haven't been signaled to search engines yet. This is likely pages that were rebuilt or updated after the data pipeline ran.

**What to fix**: Set up IndexNow submission as part of the Vercel build/deploy pipeline, or submit manually via Ahrefs or directly to the IndexNow API.

Option A — Manual submission via Ahrefs:
In Ahrefs → Site Audit → Pages to submit to IndexNow → Submit All

Option B — Automated via Vercel deploy hook. Create a script at `scripts/submit-indexnow.js`:

```javascript
// scripts/submit-indexnow.js
// Run after build to submit all city/state page URLs to IndexNow
// Requires INDEXNOW_API_KEY env var

const BASE_URL = 'https://www.recycleoldtech.com';
const API_KEY = process.env.INDEXNOW_API_KEY;

// Collect all city and state URLs from your sitemap or build output
// Then POST to IndexNow API

async function submitToIndexNow(urls) {
  const response = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: 'www.recycleoldtech.com',
      key: API_KEY,
      keyLocation: `${BASE_URL}/${API_KEY}.txt`,
      urlList: urls
    })
  });
  console.log('IndexNow response:', response.status);
}
```

Add `INDEXNOW_API_KEY` to Vercel environment variables and generate the key verification file at `public/{key}.txt`.

---

## Priority 7: 17 Pages Flagged for High AI Content — CONTENT FIX (Database)

**Issue**: Ahrefs flags 17 pages with high AI content levels. Google's Helpful Content system penalizes thin, AI-generated content that doesn't add value. These are almost certainly city pages with generic descriptions generated by the pipeline.

**What to fix**: Identify which 17 pages are flagged (check Ahrefs Site Audit → Content → Pages have high AI content levels). These pages likely have short, formulaic descriptions like:

> "Clean Earth is an electronics recycling center in Phoenix, Arizona."

This is the kind of minimal description that scores poorly. For the flagged pages, update the `description` field in the database with more specific, useful content.

**Supabase query to find short/thin descriptions**:
```sql
-- Find recycling centers with very short descriptions (likely AI-flagged pages)
SELECT id, name, city, state, description, content_enhanced
FROM recycling_centers
WHERE LENGTH(description) < 100
  AND description IS NOT NULL
ORDER BY LENGTH(description) ASC
LIMIT 50;
```

For the worst offenders, manually update the description with 2–3 sentences that include:
- What they specifically accept
- Any certifications or specialties
- Hours or contact info if distinctive

Mark as `content_enhanced = true` after updating to protect from pipeline overwrites:
```sql
UPDATE recycling_centers
SET description = '[improved description]',
    content_enhanced = true
WHERE id = '[uuid]';
```

---

## Priority 8: Referring Domain Quality — Outreach (Not a Code Fix)

**Issue**: Of the 174 referring domains, the vast majority are spam/nofollow PBNs (buybacklinks.agency, rankxlinks.shop, seoexpress.org, etc.) with zero real traffic. All are nofollow so they pass no link equity. Your effective dofollow backlink count is very low, keeping DR stuck at 5 despite real traffic.

**What to do** (outreach, not code):

1. **Verified Partners as backlink sources**: Every recycler who claims a listing is a natural backlink candidate. Add a note to the claim confirmation email asking them to add a "Listed on RecycleOldTech.com" badge to their website. Provide badge HTML they can copy-paste.

2. **Blog post outreach**: The TV recycling guide (`/blog/tv-recycling-guide`) and the Best Buy vs Staples post are the most linkable assets. Reach out to:
   - Local news sites covering environmental topics in cities where you have strong city pages
   - State environmental agency websites (many maintain resource lists)
   - Earth911.com — they link to useful directories

3. **Disavow decision**: The spam backlinks are all nofollow, so disavow is not necessary. Do not submit a disavow file as it could accidentally harm any real links.

---

## Priority 9: "tv recycling near me" Keyword (4,900 volume, KD 26) — Content + Code

**Issue**: You rank at position 37 for "tv recycling near me" — a 4,900 monthly volume keyword with relatively low difficulty. The TV recycling blog post (`/blog/tv-recycling-guide`) was recently created and should help, but additional steps will accelerate ranking.

**What to fix**:

Step 1 — Ensure city pages that have TV recyclers prominently mention TV recycling. Check the city page template for whether the accepted items tags are visible without interaction. The tags on the Phoenix page show "TVs" as a chip — confirm this is present on all relevant pages and is crawlable text, not just JavaScript-rendered.

Step 2 — Add internal links from city pages to the TV recycling guide. In the city page Astro template, wherever TVs are mentioned or wherever a center accepts TVs, add a contextual link:

```astro
<!-- In src/pages/states/[state]/[city].astro -->
<!-- Near the accepted items section or TV-related content -->
<a href="/blog/tv-recycling-guide">TV recycling guide</a>
```

Step 3 — Add the TV recycling guide to the blog section on the homepage. Currently the homepage blog section shows 3 recent posts. Ensure the TV recycling guide appears prominently there (it should already if sorted by date).

Step 4 — In the blog post itself (`src/content/blog/tv-recycling-guide.md` or wherever blog content lives), ensure the `<title>` includes "near me":

Suggested title: `How to Recycle Your Old TV Near You in 2026 — Every Type Covered`

---

## Priority 10: Colorado State Page — Quick Win

**Issue**: `/states/colorado` ranks in positions 19–21 for three high-volume terms: "electronic disposal" (1,000/mo), "electronic recycle" (1,100/mo), and "certified electronics recycling" (400/mo). All are just off page 1.

**What to fix**: The Colorado state page needs a small content boost and more internal links.

Step 1 — In the state page template (`src/pages/states/[state].astro`), check if there is an introductory paragraph. If the intro is generic or missing, add a Colorado-specific paragraph:

```
Colorado has strong e-waste recycling infrastructure across Denver, Boulder, Colorado Springs, and Fort Collins. Whether you need to dispose of old computers, phones, TVs, or business equipment, certified facilities are available throughout the state.
```

Step 2 — Add Colorado to the homepage "Popular States" or "Popular Cities" section (as Denver). This creates a dofollow internal link from the highest-authority page on the site.

Step 3 — Add Colorado to the footer "Popular States" quick links section (currently only California, New York, Texas, Florida are listed).

---

## Priority 11: Duplicate Listing Cleanup — Database Fix

**Issue**: Identified previously — Culver City CA has duplicate SoCal Recycling entries with the same address. There are likely other duplicates across the dataset.

**Supabase query to find duplicates**:
```sql
-- Find potential duplicates by name + city + state
SELECT
  name,
  city,
  state,
  COUNT(*) as count,
  ARRAY_AGG(id) as ids,
  ARRAY_AGG(phone) as phones
FROM recycling_centers
GROUP BY name, city, state
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 50;
```

For high-confidence duplicates (same phone number):
```sql
-- Same name, city, and phone
SELECT
  name, city, state, phone,
  COUNT(*) as count,
  ARRAY_AGG(id) as ids
FROM recycling_centers
WHERE phone IS NOT NULL
GROUP BY name, city, state, phone
HAVING COUNT(*) > 1;
```

For each duplicate set, keep the record with `content_enhanced = true` if one exists, otherwise keep the one with more complete data (more fields populated). Delete the duplicate:

```sql
-- Soft approach: mark as inactive rather than delete
UPDATE recycling_centers
SET is_active = false  -- or whatever your inactive flag is
WHERE id = '[duplicate-uuid]';

-- Hard delete if no soft-delete column:
DELETE FROM recycling_centers WHERE id = '[duplicate-uuid]';
```

---

## Priority 12: robots.txt Verification — Code Check

**Issue**: The site audit shows a "Referring domains dropped" notice (8 domains dropped). This could be related to robots.txt changes made when bot traffic was blocked. Verify robots.txt is not accidentally blocking Googlebot or Ahrefs crawler.

**What to check**: Fetch `https://www.recycleoldtech.com/robots.txt` and confirm:

```
User-agent: *
Allow: /

User-agent: Googlebot
Allow: /
```

If there are `Disallow` rules for crawlers beyond the bots/scrapers you intended to block, remove or narrow them. The US-IP restriction at the Vercel/middleware level should not affect Googlebot (which crawls from US IPs) but confirm Googlebot is not being blocked.

**File to check**: `public/robots.txt` in the repo.

---

## Summary: Fix Priority Order

| Priority | Issue | Type | Effort |
|----------|-------|------|--------|
| 1 | Title tags too long (32 pages) | Code | Low |
| 2 | Meta descriptions too long (10 pages) | Code | Low |
| 3 | HTTP image URLs (2 pages) | Code + DB | Low |
| 4 | New 404 page | Code or DB | Low |
| 5 | Page 2 keywords — internal linking | Code | Medium |
| 6 | IndexNow submission (486 pages) | Code | Low |
| 7 | High AI content (17 pages) | Database | Medium |
| 8 | Backlink quality | Outreach | Ongoing |
| 9 | TV recycling keyword push | Code + Content | Medium |
| 10 | Colorado state page boost | Code | Low |
| 11 | Duplicate listings | Database | Low |
| 12 | robots.txt verification | Code | Low |

---

## Key Files Reference (ewaste-dir repo)

Based on live page inspection, these are the likely file paths for each concern:

```
src/
  pages/
    index.astro                    # Homepage — add Colorado, Denver
    states/
      [state].astro                # State pages — title/meta/content
      [state]/[city].astro         # City pages — title/meta/TV links
    blog/
      [slug].astro or [...slug].astro  # Blog routing
  layouts/
    Layout.astro                   # Shared head/title/meta (likely)
  content/
    blog/                          # Blog markdown files
public/
  robots.txt                       # Verify bot rules
vercel.json                        # Redirects (797 already added)
```

---

## Environment Notes

- Supabase project: check `.env` for `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- The `content_enhanced` column protects records from pipeline overwrites — always set it to `true` when manually editing descriptions
- Vercel project ID: `prj_fm75cWfWzoju5w8Y6XdDD5WsDlUo`
- Team ID: `team_HRtphrrCbKdlhhSjOT39DZYh`
- Ahrefs site audit project ID: `8362376`
