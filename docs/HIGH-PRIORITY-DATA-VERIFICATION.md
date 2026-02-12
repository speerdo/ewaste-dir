# RecycleOldTech Data Verification Strategy

## Project Context
RecycleOldTech.com is an electronics recycling directory that needs accurate, verified venue data. This document outlines the strategy for building a high-quality database through fresh discovery rather than verification of stale, questionable data.

**Current Database State (as of Feb 2026):**
- **28,521 recycling centers** across 51 states and 3,235 cities
- 99.6% have descriptions (but most are generic templates, not factual)
- 86.4% have websites, 96.5% have phone numbers, 87.4% have ratings
- 92.2% marked legitimate, 4.0% marked suspicious
- Scraped June-July 2025 (7-8 months old)
- **Phase 1 classification complete:** 28,132 centers classified via Gemini AI

**Core Problem:**
The existing database was scraped 7-8 months ago, contains generic template descriptions, and many entries may be computer repair shops, phone repair stores, or other businesses that don't primarily offer e-waste recycling. Attempting to verify 28,521 entries of questionable origin is expensive and backwards -- we'd be spending money to check bad data rather than finding good data.

**Revised Strategy:**
Instead of verifying the existing database, we will **run fresh discovery** using Google Places Text Search across all 3,235 cities. This gives us Google-verified, current business data directly from the authoritative source.

**Why this is better than the original verification plan:**
1. **Accuracy** -- Google Places data is current, verified, and authoritative
2. **Cost** -- Text Search Pro has a 5,000 free requests/month cap (covers nearly all our cities)
3. **Freshness** -- We get live business status, hours, phone, website (not 8-month-old scrapes)
4. **Simplicity** -- One-pass discovery vs. multi-phase classify-then-verify
5. **Completeness** -- We find centers we missed originally, not just verify what we have

**Budget Constraint:** Minimize cost. Accuracy is the top priority.

---

## Available API Keys & Environment Variables

```bash
# Available (from .env.example)
PUBLIC_SUPABASE_URL=           # Supabase project URL
PUBLIC_SUPABASE_ANON_KEY=      # Supabase anon key (read-only)
PUBLIC_SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role (read/write)
PUBLIC_GOOGLE_MAPS_API_KEY=    # Google Maps API key
GOOGLE_PLACES_API_KEY=         # Google Places API key
GEMINI_API_KEY=                # Google Gemini AI key (free tier: 1,500 req/day)
REVALIDATION_TOKEN=            # Cache revalidation token
```

**Required Google APIs (enable in Google Cloud Console):**
- Places API (New) -- for Text Search and Place Details
- Gemini API -- for classification and description generation

---

## Actual Database Schema (`recycling_centers`)

The actual table columns (verified against live DB):

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PRIMARY KEY |
| name | text | NOT NULL |
| site | text | Website URL |
| phone | text | Phone number |
| full_address | text | Full street address |
| city | text | City name |
| postal_code | integer | ZIP code |
| state | text | State name |
| latitude | numeric | Lat coordinate |
| longitude | numeric | Lng coordinate |
| rating | numeric | Google rating |
| reviews | numeric | Review count |
| photo | text | Photo URL |
| logo | text | Logo URL |
| description | text | Center description |
| working_hours | jsonb | Hours of operation |
| legitimacy_score | integer | Legitimacy score |
| legitimacy_reason | text | Explanation of score |
| is_legitimate | boolean | Verified legitimate |
| is_suspicious | boolean | Flagged suspicious |
| scraped_at | timestamptz | Last scrape time |
| excluded_specialties | jsonb | Specialties to exclude |
| created_at | timestamptz | Row creation time |
| updated_at | timestamptz | Row update time |

**Note:** The `DATABASE_SCHEMA.md` documents additional columns (`accepted_items`, `services_offered`, `certifications`, `content_enhanced`, etc.) that have NOT been created via migration yet. We will add them as part of this effort.

### Schema Migration Needed

Before running discovery, apply this migration to add structured data columns:

```sql
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS accepted_items jsonb DEFAULT '[]';
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS services_offered jsonb DEFAULT '[]';
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]';
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS center_type text;
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS verification_source text;
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS business_status text;
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS discovery_batch text;
```

**Column purposes:**
- `accepted_items` - JSON array of accepted electronics: `["computers", "tvs", "monitors", "phones", "printers", "batteries"]`
- `services_offered` - JSON array of services: `["data_destruction", "pickup", "free_dropoff", "onsite_shredding", "business_services"]`
- `certifications` - JSON array: `["R2", "e-Stewards", "NAID", "ISO 14001"]`
- `center_type` - Classification: `"dedicated_ewaste"`, `"retail_dropoff"`, `"repair_with_recycling"`, `"scrap_metal"`, `"municipal"`, `"itad"`
- `verified_at` - When this center was last verified
- `verification_source` - How it was verified: `"google_places_discovery"`, `"gemini_classify"`, `"manual"`
- `google_place_id` - Google Places unique ID for future re-verification
- `business_status` - From Google: `"OPERATIONAL"`, `"CLOSED_TEMPORARILY"`, `"CLOSED_PERMANENTLY"`
- `discovery_batch` - Which discovery run found/updated this center (e.g., `"2026-02-discovery"`)

---

## The New Strategy: Fresh Discovery

### Why We're Changing the Approach

The original 4-phase plan was:
1. AI Classification (Gemini) -- **COMPLETED** (28,132 centers classified)
2. Google Places Verification (targeted) -- est. $80-$135
3. Discovery (find missing centers) -- est. $19
4. Enrichment -- $0

**What we learned from Phase 1:** Classification alone can't tell us if a business is real, still open, or actually accepts e-waste. It only guesses based on the name. To truly verify, we'd still need to hit Google Places for thousands of uncertain entries -- spending money to check data that may be largely wrong.

**The new insight:** Instead of paying to verify bad data, we should pay to **discover good data**. Google Places Text Search (New) has a **5,000 free requests/month** cap at the Pro tier, which is enough to search every one of our 3,235 cities. We get authoritative, current data directly from Google.

### The Three-Phase Discovery Strategy

#### Phase 1: Google Places Discovery (Text Search Pro)
**Goal:** Find all real e-waste/electronics recycling businesses across our 3,235 cities.

**Method:**
1. For each city in our `cities` table, run a Text Search (New) query:
   - Primary query: `"electronics recycling in {city}, {state}"`
   - Use field masks for **Pro-tier only**: `displayName`, `formattedAddress`, `location`, `types`, `businessStatus`, `photos`, `addressComponents`
   - **Do NOT include** `internationalPhoneNumber`, `websiteUri`, `regularOpeningHours`, `rating`, `userRatingCount` -- these are **Enterprise tier** on Text Search ($35/1K, only 1K free). We get them cheaper via Place Details Pro in Phase 1.5.
2. Collect all results with their Google Place IDs
3. Handle pagination (nextPageToken) for cities with >20 results
4. Deduplicate by `google_place_id` (same business may appear in searches for neighboring cities)

**Request Estimate:**
- 3,235 cities × 1 primary query = 3,235 requests
- Pagination for large cities (~200 cities need 2nd page): +200 requests
- **Total: ~3,435 requests** (within the 5,000/month free cap)

**Cost: $0** (within free tier)

**What we get per result (Pro tier):**
- `places.id` → Google Place ID (for dedup and future re-verification)
- `places.displayName` → Business name
- `places.formattedAddress` → Full street address
- `places.addressComponents` → Parsed city, state, postal code
- `places.location` → Lat/lng coordinates
- `places.types` → Google place types (e.g., `electronics_store`, `recycling_center`)
- `places.businessStatus` → Open/closed status
- `places.photos` → Photo references (fetching actual images is a separate $7/1K SKU)

**What we do NOT get from Text Search Pro (these require Enterprise at $35/1K):**
- Phone number, website URL, business hours, rating, review count
- These are fetched cheaper via Place Details Pro ($17/1K) in Phase 1.5

#### Phase 1.5: Place Details Pro (Contact Info & Ratings)
**Goal:** Get phone, website, hours, rating, and review count for all discovered centers.

**Why a separate step?** On Text Search, phone/website/hours/rating are Enterprise tier ($35/1K, 1K free). On Place Details, the same fields are Pro tier ($17/1K, **5K free**). By splitting discovery (Text Search Pro) from detail fetching (Place Details Pro), we save significantly.

**Method:**
1. After Phase 1 discovery + Phase 2 classification, we know which centers to keep (~10,000-15,000)
2. For each "keep" center, call Place Details (New) with its `google_place_id`
3. Use field masks for Pro-tier fields: `internationalPhoneNumber`, `websiteUri`, `regularOpeningHours`, `rating`, `userRatingCount`

**Request Estimate:**
- ~10,000-15,000 confirmed centers
- First 5,000 free (Place Details Pro free cap)
- Remaining: 5,000-10,000 paid requests

**Cost: $85-$170** (at $17 per 1,000 requests)

**Cost optimization option -- spread across months:**
- Month 1: Place Details Pro for first 5,000 centers → $0 (free cap)
- Month 2: Place Details Pro for next 5,000 centers → $0 (new free cap)
- Month 3: Place Details Pro for remaining ~2,000-5,000 → $0 (new free cap)
- **Total if spread across 3 months: $0**

**What we get per result (Pro tier):**
- `internationalPhoneNumber` → Phone number
- `websiteUri` → Website URL
- `regularOpeningHours` → Business hours (JSON with periods and weekday descriptions)
- `rating` → Google rating (1.0-5.0)
- `userRatingCount` → Number of Google reviews

#### Phase 2: AI Classification & Enrichment (Gemini Flash)
**Goal:** Classify discovered centers, generate factual descriptions, and extract structured data.

**Note:** Phase 2 runs after Phase 1 but **before** Phase 1.5. This lets us classify first, then only fetch Place Details for centers we're keeping (saving money).

**Method:**
1. Batch discovered centers through Gemini Flash (50 at a time)
2. For each center, classify as: `dedicated_ewaste`, `repair_with_recycling`, `retail_dropoff`, `scrap_metal`, `municipal`, `itad`, `not_ewaste`
3. Filter out non-e-waste businesses (general recycling, junk removal, etc.)
4. For "keep" centers, extract `accepted_items`, `services_offered`, `certifications` from name + Google types
5. Generate factual 2-3 sentence **unique descriptions** for every kept center

**Request Estimate:**
- Classification: ~15,000-25,000 discovered places / 50 per batch = 300-500 requests
- Description generation: ~10,000-18,000 verified centers / 10 per batch = 1,000-1,800 requests
- Accepted items extraction: ~10,000-18,000 centers / 20 per batch = 500-900 requests
- **Total: ~1,800-3,200 requests** (spread over 2-3 days at 1,500/day free limit)

**Cost: $0** (Gemini Flash free tier: 1,500 requests/day)

#### Phase 3: Database Reconciliation & Update
**Goal:** Merge discovered data with existing database; update, add, and flag entries.

**Method:**
1. **Match** discovered centers against existing database by:
   - Google Place ID (if we stored it from original scrape)
   - Name similarity + address proximity (fuzzy matching)
   - Phone number match
2. **For matches:** Update existing entries with fresh Google + Gemini data
3. **For new discoveries:** Insert as new entries with `verification_source = 'google_places_discovery'`
4. **For existing entries NOT found:** Flag for review (may be closed, renamed, or non-existent)
5. Set `verified_at`, `verification_source`, `discovery_batch` on all touched entries
6. Update `recycling_center_count` on the `cities` table

**Cost: $0** (database operations only)

### Phase 4 (Optional): Gap-Fill Discovery
**Goal:** Find centers in cities that returned 0 or very few results.

**Method:**
1. Identify cities with 0 results from Phase 1
2. Run alternative search queries:
   - `"e-waste drop off in {city}, {state}"`
   - `"computer recycling in {city}, {state}"`
   - `"Best Buy recycling {city}, {state}"` (for retail drop-offs)
3. Also search for known national chains that accept e-waste: Best Buy, Staples, Goodwill
4. Run in a subsequent month to get another 5,000 free Text Search requests

**Request Estimate:** ~500-1,500 requests
**Cost: $0-$32** (may use remaining free cap or spill into next month's free cap)

### Execution Order

The phases run in this order to minimize cost:

```
Phase 1  → Text Search Pro (discover places, get basic data)      FREE
    ↓
Phase 2  → Gemini Flash (classify, filter, describe, extract)     FREE
    ↓
Phase 1.5 → Place Details Pro (contact info for "keep" only)      $0-$170
    ↓
Phase 3  → Database reconciliation (match, insert, flag)          FREE
    ↓
Phase 4  → Gap-fill discovery (optional, next month)              FREE
```

---

## Cost Analysis

### Google Places API (New) Pricing Reference

Pricing is per 1,000 requests. Free caps are per **calendar month** and reset on the 1st.

| SKU | Cost per 1K | Free Cap/Month | Fields Included |
|-----|-------------|----------------|-----------------|
| Text Search Essentials (IDs Only) | $0 | Unlimited | `id`, `name` (resource name only) |
| **Text Search Pro** | **$32.00** | **5,000** | `displayName`, `formattedAddress`, `addressComponents`, `location`, `types`, `businessStatus`, `photos`, `primaryType` |
| Text Search Enterprise | $35.00 | 1,000 | **Adds:** `internationalPhoneNumber`, `websiteUri`, `regularOpeningHours`, `rating`, `userRatingCount` |
| Text Search Enterprise + Atmosphere | $40.00 | 1,000 | **Adds:** `reviews`, `editorialSummary`, `generativeSummary` |
| Place Details Essentials (IDs Only) | $0 | Unlimited | `id`, `name` (resource name only) |
| Place Details Essentials | $5.00 | 10,000 | Same basic fields as Text Search Pro |
| **Place Details Pro** | **$17.00** | **5,000** | **Adds:** `internationalPhoneNumber`, `websiteUri`, `regularOpeningHours`, `rating`, `userRatingCount` |
| Place Details Enterprise | $20.00 | 1,000 | **Adds:** `reviews`, `editorialSummary` |
| Place Details Photos | $7.00 | 1,000 | Fetching actual photo binary |
| Gemini 2.0 Flash | $0 | 1,500 req/day | Classification & descriptions |

**Key insight:** Phone, website, hours, and rating are **Enterprise** on Text Search ($35/1K, 1K free) but only **Pro** on Place Details ($17/1K, 5K free). This is why we split into two steps.

### Estimated Total Cost

```
Phase 1 - Discovery (Text Search Pro):
  3,235 cities × 1 query each             = 3,235 requests
  Pagination for large cities              ≈   200 requests
  ─────────────────────────────────────────────────────────
  Subtotal:                                ≈ 3,435 requests
  Free cap:                                  5,000/month
  Paid requests:                                 0
  Cost:                                        $0.00

Phase 2 - Classification (Gemini Flash):
  ~20,000 centers / 50 per batch           ≈   400 requests
  Cost:                                        $0.00 (free tier)

Phase 2 - Descriptions (Gemini Flash):
  ~15,000 centers / 10 per batch           ≈ 1,500 requests
  Cost:                                        $0.00 (free tier, spread over 1-2 days)

Phase 2 - Accepted Items (Gemini Flash):
  ~15,000 centers / 20 per batch           ≈   750 requests
  Cost:                                        $0.00 (free tier)

Phase 1.5 - Contact Info (Place Details Pro):
  ~12,000 confirmed centers                ≈ 12,000 requests
  Free cap:                                  5,000/month
  Paid requests (if done in 1 month):        7,000
  Cost (1 month):             7,000 × $0.017 = $119.00
  Cost (spread over 3 months):                 $0.00

Phase 3 - Database Update:
  Cost:                                        $0.00 (no API calls)

Phase 4 - Gap-Fill (optional, next month):
  ~1,000 additional searches               ≈ 1,000 requests
  Cost (uses next month's free cap):           $0.00
───────────────────────────────────────────────────────────
TOTAL (fast mode, 1 month):                   ~$119
TOTAL (budget mode, spread over 3 months):     ~$0
```

### Cost Comparison: Old Plan vs. New Plan

| | Old Verification Plan | New Discovery Plan (fast) | New Discovery Plan (budget) |
|--|----------------------|--------------------------|----------------------------|
| Discovery | $19 (200 cities only) | $0 (all 3,235 cities) | $0 |
| Classification | $0 (Gemini) | $0 (Gemini) | $0 |
| Contact info | $80-$135 (Places verify) | $119 (Place Details Pro) | $0 (spread 3 months) |
| Descriptions | $0 (Gemini) | $0 (Gemini) | $0 |
| Gap-fill | -- | $0 | $0 |
| **Total** | **$100-$155** | **~$119** | **~$0** |
| Data quality | Verifying stale scraped data | Fresh from Google's database | Same |
| Coverage | Existing 28K entries only | All 3,235 cities + new finds | Same |
| Timeline | 7-10 days | ~7 days | ~3 months |
| Unique descriptions | Partial | 100% of kept centers | Same |

### Budget Safeguards

1. **Set Google Cloud billing alerts** at $50, $100, $150
2. **Monitor usage** in Google Cloud Console after first 100 cities
3. **Use field masks carefully** -- Text Search Pro only (no Enterprise fields), Place Details Pro only (no Enterprise fields)
4. **Spread Place Details across months** to stay within free caps if budget is tight
5. **Script has `--limit` flag** for testing with small batches
6. **Never request `places.reviews`** -- triggers Enterprise + Atmosphere tier ($40/1K)

---

## Implementation: Single Unified Script

### File Structure
```
scripts/
├── lib/
│   ├── config.js              # Shared env vars, CLI args, constants, field masks
│   ├── progress.js            # Progress tracking, graceful shutdown, resume
│   └── supabase.js            # Supabase client, paginated fetches (1K row limit)
├── 1-discover.js              # Phase 1: Google Places Text Search Pro
├── 2-classify.js              # Phase 2: Gemini classification + descriptions
├── 3-fetch-details.js         # Phase 1.5: Google Place Details Pro
├── 4-reconcile.js             # Phase 3: Database reconciliation
├── generate-ads-txt.js        # (build dependency - kept from original)
├── optimize-for-build.js      # (build dependency - kept from original)
├── verify-ssr.js              # (build dependency - kept from original)
└── archive/                   # 61 old scripts (moved, not deleted)

data/
├── discovery/
│   ├── progress.json          # Which cities are done (auto-generated)
│   ├── results.json           # All discovered places (auto-generated)
│   └── stats.json             # Summary statistics (auto-generated)
├── classification/
│   ├── progress.json          # Classification progress (auto-generated)
│   ├── results.json           # Classified "keep" centers (auto-generated)
│   ├── all-classified.json    # All centers incl. rejected (auto-generated)
│   └── stats.json             # Summary statistics (auto-generated)
├── details/
│   ├── progress.json          # Fetch progress (auto-generated)
│   ├── results.json           # Enriched centers with contact info (auto-generated)
│   └── stats.json             # Summary + field coverage (auto-generated)
└── reconciliation/
    └── report.json            # Match/insert/flag report (auto-generated)
```

### CLI Usage

Each script is independent and run in order. All support `--help` for full usage.

```bash
# ── Phase 1: Discovery ─────────────────────────────────────────────────
node scripts/1-discover.js --city "Indianapolis" --state "Indiana"   # Single city test
node scripts/1-discover.js --state "Indiana"                         # Single state
node scripts/1-discover.js --limit 5                                 # First 5 cities
node scripts/1-discover.js --estimate                                # Cost estimate only
node scripts/1-discover.js                                           # All 3,235 cities
node scripts/1-discover.js --resume                                  # Resume after interruption

# ── Phase 2: Classification + Descriptions ─────────────────────────────
node scripts/2-classify.js --limit 100                               # Test on 100 centers
node scripts/2-classify.js                                           # All discovered centers
node scripts/2-classify.js --resume                                  # Resume (Gemini daily limit)

# ── Phase 1.5: Place Details ───────────────────────────────────────────
node scripts/3-fetch-details.js --estimate                           # Cost estimate
node scripts/3-fetch-details.js --limit 100                          # Test on 100
node scripts/3-fetch-details.js --max-cost 50                        # Stop at $50
node scripts/3-fetch-details.js                                      # All "keep" centers
node scripts/3-fetch-details.js --resume                             # Resume

# ── Phase 3: Database Reconciliation ───────────────────────────────────
node scripts/4-reconcile.js --dry-run                                # Report only
node scripts/4-reconcile.js --city "Indianapolis" --state "Indiana"  # Single city
node scripts/4-reconcile.js                                          # Full reconciliation
```

### Built-in Safety Features

All scripts include:
- **SIGINT/SIGTERM handling**: Ctrl+C saves progress before exiting
- **`--resume`**: Picks up where it left off, never double-processes a city or center
- **`--dry-run`**: Shows what would happen without API calls or DB writes
- **`--estimate`**: Shows cost estimate without running (scripts 1 & 3)
- **`--limit N`**: Process only the first N items for testing
- **`--city` / `--state`**: Filter to a single city or state for testing
- **Progress files**: Saved after every 5 items; crash-safe
- **API cost tracking**: Tracks calls made, estimates cost, respects free tier caps
- **Gemini daily limit**: Auto-stops at 1,490 calls/day, resume next day
- **Rate limit handling**: Exponential backoff on 429 errors
- **Error logging**: Errors recorded in progress file, items skipped gracefully
```

---

## Google Places API (New) Details

### Phase 1: Text Search Request (Pro Tier)

```javascript
// POST https://places.googleapis.com/v1/places:searchText
// SKU: Text Search Pro ($32/1K, 5K free/month)
const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
    'X-Goog-FieldMask': [
      'places.id',                // Google Place ID (for dedup + Phase 1.5)
      'places.displayName',       // Business name
      'places.formattedAddress',  // Full address string
      'places.addressComponents', // Parsed city, state, ZIP
      'places.location',          // Lat/lng
      'places.types',             // Google place types
      'places.businessStatus',    // OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY
      'places.photos',            // Photo references (not binary)
      'places.primaryType',       // Primary business type
      'nextPageToken',            // For pagination
    ].join(',')
  },
  body: JSON.stringify({
    textQuery: 'electronics recycling in Indianapolis, Indiana',
    languageCode: 'en',
    pageSize: 20,
  })
});
```

**CRITICAL: Do NOT add these fields to Text Search** -- they trigger Enterprise tier ($35/1K, 1K free):
- `places.internationalPhoneNumber`
- `places.websiteUri`
- `places.regularOpeningHours`
- `places.rating`
- `places.userRatingCount`

These are fetched via Place Details Pro instead (see Phase 1.5).

### Text Search Response Structure

```json
{
  "places": [
    {
      "id": "ChIJ...",
      "displayName": { "text": "IndyGreen E-Waste Recycling", "languageCode": "en" },
      "formattedAddress": "123 Main St, Indianapolis, IN 46201",
      "addressComponents": [
        { "longText": "123", "shortText": "123", "types": ["street_number"] },
        { "longText": "Main Street", "shortText": "Main St", "types": ["route"] },
        { "longText": "Indianapolis", "shortText": "Indianapolis", "types": ["locality"] },
        { "longText": "Indiana", "shortText": "IN", "types": ["administrative_area_level_1"] },
        { "longText": "46201", "shortText": "46201", "types": ["postal_code"] }
      ],
      "location": { "latitude": 39.7684, "longitude": -86.1581 },
      "types": ["recycling_center", "electronics_store"],
      "businessStatus": "OPERATIONAL",
      "primaryType": "recycling_center",
      "photos": [
        { "name": "places/ChIJ.../photos/...", "widthPx": 4032, "heightPx": 3024 }
      ]
    }
  ],
  "nextPageToken": "..." // if more results exist
}
```

### Pagination

If a city has more than 20 results, the response includes `nextPageToken`. To get the next page:

```javascript
const nextPage = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: { /* same headers */ },
  body: JSON.stringify({
    textQuery: 'electronics recycling in Indianapolis, Indiana',
    pageToken: response.nextPageToken,
  })
});
```

Each page request counts as a separate billable event.

### Phase 1.5: Place Details Request (Pro Tier)

```javascript
// GET https://places.googleapis.com/v1/places/{placeId}
// SKU: Place Details Pro ($17/1K, 5K free/month)
const placeId = 'ChIJ...'; // from Text Search results
const detailsResponse = await fetch(
  `https://places.googleapis.com/v1/places/${placeId}`,
  {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': [
        'internationalPhoneNumber',  // Phone number
        'websiteUri',                // Website URL
        'regularOpeningHours',       // Business hours
        'rating',                    // Google rating (1.0-5.0)
        'userRatingCount',           // Number of reviews
      ].join(',')
    }
  }
);
```

**CRITICAL: Do NOT add these fields to Place Details** -- they trigger Enterprise tier ($20/1K, 1K free):
- `reviews` (review text content)
- `editorialSummary`

### Place Details Response Structure

```json
{
  "internationalPhoneNumber": "+1 317-555-0123",
  "websiteUri": "https://indygreen.com",
  "regularOpeningHours": {
    "openNow": true,
    "periods": [
      {
        "open": { "day": 1, "hour": 8, "minute": 0 },
        "close": { "day": 1, "hour": 17, "minute": 0 }
      }
    ],
    "weekdayDescriptions": [
      "Monday: 8:00 AM – 5:00 PM",
      "Tuesday: 8:00 AM – 5:00 PM",
      "..."
    ]
  },
  "rating": 4.5,
  "userRatingCount": 127
}
```

### Photo URLs

Text Search Pro returns photo **references**, not URLs. To get a displayable photo URL:

```javascript
// SKU: Place Details Photos ($7/1K, 1K free/month)
const photoRef = place.photos[0].name; // e.g. "places/ChIJ.../photos/..."
const photoUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=400&key=${GOOGLE_PLACES_API_KEY}`;
```

**Cost consideration:** At $7/1K (1K free), fetching photos for ~12,000 centers = $77. This is optional -- we can reuse existing photos from the current DB where they match, and only fetch photos for new discoveries. Or skip entirely if budget is tight.

---

## Gemini Prompts

### Phase 2a: Classification Prompt (batch of 50)

```
You are classifying businesses found via Google Places search for "electronics recycling".
For each business, determine its type based on the name AND Google place types.

TYPES:
- dedicated_ewaste: Dedicated e-waste/electronics recycling facility
- repair_with_recycling: Computer/phone repair that also recycles
- retail_dropoff: Retail store with recycling program (Best Buy, Staples, etc.)
- scrap_metal: Scrap metal dealer that may accept electronics
- municipal: Government/municipal recycling program
- itad: IT Asset Disposition company (business-focused)
- not_ewaste: NOT an electronics recycler (general recycling, junk removal, clothing, etc.)

BUSINESSES:
{array of {name, types, address} objects}

For each, return:
- type: one of the types above
- confidence: 0.0-1.0
- keep: true/false (true if this business likely accepts consumer electronics for recycling)
- reason: brief explanation (10 words max)

Return JSON array only: [{"name": "...", "type": "...", "confidence": 0.9, "keep": true, "reason": "..."}]
```

### Phase 2b: Description Generation Prompt (batch of 10)

```
Write a concise, factual 2-3 sentence description for each electronics recycling center.

RULES:
- Sentence 1: What they are and their primary service
- Sentence 2: Key differentiators (data destruction, pickup, certifications, free drop-off)
- Sentence 3 (optional): Fees, restrictions, or notable details if inferable
- DO NOT use marketing language ("best", "leading", "top-rated")
- DO NOT include hours, phone, or address (displayed separately on the page)
- DO NOT make claims not supported by the data
- If data is limited, write 1-2 factual sentences only. Do not pad with generic filler.
- Tone: Professional, factual, helpful

CENTERS:
{array of {name, type, city, state, google_types, rating, review_count} objects}

Return JSON array: [{"name": "...", "description": "..."}]
```

### Phase 2c: Accepted Items Extraction Prompt (batch of 20)

```
Based on the business name and type, infer what electronics this center likely accepts.
Only include items you are reasonably confident about. Use null for unknown.

ITEMS (choose from): computers, laptops, phones, tablets, monitors, tvs, printers,
batteries, cables, small_appliances, crt_monitors, servers, networking_equipment, copiers

SERVICES (choose from): free_dropoff, paid_dropoff, pickup, data_destruction,
onsite_shredding, business_services, residential_services, mail_in

CENTERS:
{array of {name, type, city, state} objects}

Return JSON array: [{"name": "...", "accepted_items": [...], "services": [...], "certifications": [...]}]
Only set values you are confident about. Use empty arrays for unknown.
```

---

## Deduplication Strategy

### Cross-City Deduplication

The same business may appear in searches for multiple nearby cities. Deduplicate by:

1. **Primary key:** `google_place_id` (exact match = same business)
2. **Fuzzy match:** For entries without Google Place ID matching existing DB:
   - Normalize names (lowercase, remove "LLC", "Inc", punctuation)
   - Compare addresses (street number + street name match)
   - Proximity check (within 0.5 miles / ~800m)
   - Phone number match

### Assigning City to Multi-City Results

When a business appears for multiple city searches:
- Use the city from the business's `formattedAddress` (authoritative)
- If address city doesn't match any of our cities, assign to the nearest city in our DB

---

## Database Reconciliation Logic

### Matching Existing Entries

```
For each discovered center:
  1. Check if google_place_id exists in our DB → UPDATE existing row
  2. Check if name + city fuzzy match (>85% similarity) → UPDATE existing row
  3. Check if address proximity match (<0.5 mi) + similar name → UPDATE existing row
  4. No match → INSERT as new entry

For each existing DB entry NOT matched by any discovery result:
  1. If classified as not_ewaste by Phase 1 (prior Gemini work) → soft-delete
  2. If classified as dedicated_ewaste but not found → flag for manual review
  3. If classified as uncertain → soft-delete (couldn't verify)
```

### Complete DB Column Mapping

Every column in `recycling_centers` and its data source in the new discovery pipeline:

| DB Column | Source | Phase | Notes |
|-----------|--------|-------|-------|
| `id` | Auto-generated | -- | UUID, PRIMARY KEY. Keep existing for matched entries; generate new for inserts. |
| `name` | Text Search Pro (`displayName`) | Phase 1 | Keep existing if matched, use Google name for new entries. |
| `site` | Place Details Pro (`websiteUri`) | Phase 1.5 | Updated from Google. Null if not available. |
| `phone` | Place Details Pro (`internationalPhoneNumber`) | Phase 1.5 | Updated from Google. Null if not available. |
| `full_address` | Text Search Pro (`formattedAddress`) | Phase 1 | Full address string from Google. |
| `city` | Text Search Pro (`addressComponents`) | Phase 1 | Extracted from component with type `locality`. |
| `postal_code` | Text Search Pro (`addressComponents`) | Phase 1 | Extracted from component with type `postal_code`. |
| `state` | Text Search Pro (`addressComponents`) | Phase 1 | Extracted from component with type `administrative_area_level_1`. |
| `latitude` | Text Search Pro (`location.latitude`) | Phase 1 | From Google. |
| `longitude` | Text Search Pro (`location.longitude`) | Phase 1 | From Google. |
| `rating` | Place Details Pro (`rating`) | Phase 1.5 | Google rating (1.0-5.0). Null if no reviews. |
| `reviews` | Place Details Pro (`userRatingCount`) | Phase 1.5 | Number of Google reviews. |
| `photo` | Text Search Pro (`photos[0]`) | Phase 1 | Photo reference from Google. Actual URL requires Photos SKU ($7/1K). Reuse existing photos for matched entries when possible. |
| `logo` | Not available from Google | -- | Set to null for new entries. Keep existing for matched entries. Google Places does not return logos. |
| `description` | **Gemini Flash** | **Phase 2** | **Unique, factual 2-3 sentence description generated for EVERY kept center.** Replaces old template descriptions. |
| `working_hours` | Place Details Pro (`regularOpeningHours`) | Phase 1.5 | JSON with `periods` and `weekdayDescriptions`. |
| `legitimacy_score` | Gemini Flash (confidence) | Phase 2 | Map classification confidence (0.0-1.0) to integer score (0-100). |
| `legitimacy_reason` | Gemini Flash (reason) | Phase 2 | Brief explanation from classification. |
| `is_legitimate` | Gemini Flash (`keep` flag) | Phase 2 | `true` if Gemini says keep and Google shows OPERATIONAL. |
| `is_suspicious` | Gemini Flash | Phase 2 | `true` if confidence < 0.5 or type is `uncertain`. |
| `scraped_at` | Set to discovery timestamp | Phase 3 | When this data was fetched from Google. |
| `excluded_specialties` | Keep existing / null | -- | Not populated by discovery. Keep for matched entries. |
| `created_at` | Auto (Supabase default) | -- | Row creation timestamp. |
| `updated_at` | Auto (Supabase trigger) | -- | Row last-modified timestamp. |
| **New columns (migration):** | | | |
| `accepted_items` | **Gemini Flash** | **Phase 2** | JSON array: `["computers", "phones", "tvs", ...]`. Inferred from name + Google types. |
| `services_offered` | **Gemini Flash** | **Phase 2** | JSON array: `["free_dropoff", "data_destruction", ...]`. Inferred from name + type. |
| `certifications` | **Gemini Flash** | **Phase 2** | JSON array: `["R2", "e-Stewards", ...]`. Only if clearly indicated. |
| `center_type` | **Gemini Flash** | **Phase 2** | One of: `dedicated_ewaste`, `retail_dropoff`, `repair_with_recycling`, `scrap_metal`, `municipal`, `itad`. |
| `verified_at` | Set to `now()` | Phase 3 | Timestamp of verification. |
| `verification_source` | Set to `'google_places_discovery'` | Phase 3 | How this entry was verified. |
| `google_place_id` | Text Search Pro (`id`) | Phase 1 | Google's unique place identifier. Critical for dedup and future re-verification. |
| `business_status` | Text Search Pro (`businessStatus`) | Phase 1 | `OPERATIONAL`, `CLOSED_TEMPORARILY`, or `CLOSED_PERMANENTLY`. |
| `discovery_batch` | Set to `'2026-02-discovery'` | Phase 3 | Which discovery run created/updated this entry. |

### Description Coverage Guarantee

**Every kept center gets a unique Gemini-generated description.** This is non-negotiable. The Phase 2 description generation step runs for ALL centers where `keep = true` after classification. No center will retain a template description like "Specialized electronics retailer offering comprehensive recycling services..."

For centers where we have limited data (only name + address + Google types), Gemini will write 1-2 factual sentences rather than pad with generic filler. A short, accurate description is better than a long, fake one.

### Fields NOT available from Google Places

These fields have no Google Places equivalent and are handled separately:

| Field | Strategy |
|-------|----------|
| `logo` | Not available. Keep existing for matched entries, null for new. Could potentially scrape from business website in a future enhancement. |
| `excluded_specialties` | Keep existing for matched entries, null for new. This is app-specific data. |
| `photo` (actual URL) | Text Search returns photo references, not URLs. Fetching actual photos costs $7/1K (1K free). Options: (a) reuse existing photos for matched entries, (b) only fetch for new discoveries, (c) skip if budget-constrained. |

---

## Testing Strategy

### Step 1: Small Discovery Test (5 cities)

**Goal:** Validate Text Search returns useful e-waste results.

1. Pick 5 diverse cities:
   - 1 large metro: Indianapolis, IN (~50+ expected centers)
   - 1 medium city: Fort Wayne, IN (~10-20 expected)
   - 1 small city: Bloomington, IN (~5-10 expected)
   - 1 rural area: Columbus, IN (~1-5 expected)
   - 1 city with known retail drop-offs: any city with Best Buy
2. Run Phase 1 discovery on these 5 cities: `--phase discover --limit 5`
3. Manually review all results:
   - Are they actually electronics recyclers?
   - Are duplicates correctly caught?
   - Is the data (address, phone, hours) accurate?
   - How many are false positives (not e-waste)?

**Expected outcome:** 80%+ of results should be legitimate e-waste related businesses.

### Step 2: Classification Accuracy Test

**Goal:** Validate Gemini correctly classifies discovered centers.

1. Run Phase 2 on the 5 test cities: `--phase classify --limit 5`
2. Manually verify 30+ classifications against the business's website
3. Check:
   - Are `dedicated_ewaste` centers actually dedicated recyclers?
   - Are `not_ewaste` centers correctly excluded?
   - Are `retail_dropoff` centers correct (Best Buy, Staples)?

**Target accuracy:** >90% classification accuracy.

### Step 3: Reconciliation Test

**Goal:** Validate matching logic against existing DB.

1. Run Phase 3 on test cities: `--phase reconcile --limit 5 --dry-run`
2. Review the reconciliation report:
   - How many existing entries matched?
   - How many new entries discovered?
   - How many existing entries flagged for removal?
3. Spot-check 20 matches to verify they're the same business

### Step 4: Full State Test

**Goal:** Validate at scale before running nationally.

1. Run all phases on 1 state: `--state "Indiana"`
2. Review summary statistics
3. Compare before/after center counts per city
4. Verify no data loss for clearly legitimate centers

**Success Criteria:**
- Discovery returns relevant results: >80% e-waste related
- Classification accuracy: >90%
- Reconciliation match rate: >60% of existing entries found
- No false removals of clearly legitimate centers
- Cost within budget ($0 for test runs)

---

## Decisions Made

### 1. Skip Verification of Existing Data? **YES**
The existing 28,521 entries were scraped 7-8 months ago and many are questionable. Rather than spending $80-$135 verifying stale data, we discover fresh data from Google Places for $0-$32. Existing entries that match discoveries get updated; unmatched entries get flagged.

### 2. Include Retail Drop-Off Programs? **YES**
Best Buy, Staples, Goodwill, etc. are useful for consumers. Classify as `retail_dropoff` and display with a badge on the site.

### 3. What Happens to Existing Entries Not Found by Discovery?
- If Phase 1 (prior Gemini work) classified as `not_ewaste` → soft-delete
- If classified as `dedicated_ewaste` but not in Google Places → flag for manual review (may be too small for Google, or recently closed)
- If `uncertain` → soft-delete (can't verify from any source)
- Never hard-delete; keep in a backup and use soft-delete (`business_status = 'NOT_FOUND'`)

### 4. Use Places API (New) vs Legacy? **NEW**
The New API has field masks for cost control and better free tier (5K free Text Search Pro vs. no free tier on Legacy). The Legacy API is being phased out.

### 5. How Many Search Queries Per City? **1 primary, optional 1-2 alternates**
- Primary: `"electronics recycling in {city}, {state}"`
- This is broad enough to catch dedicated recyclers, retail drop-offs, and municipal programs
- Alternative queries only for cities with 0 results (Phase 4 gap-fill)

### 6. Batch Size? **50 for classification, 10 for descriptions**
- Gemini classification: 50 centers per batch (name + types, small payload)
- Gemini descriptions: 10 centers per batch (need more tokens for quality output)

### 7. How to Handle the $200 Monthly Credit?
The $200/month credit ended February 2025. We rely on the per-SKU free caps instead, which are permanent.

---

## Risk Mitigation

### Risk 1: API Cost Overrun
- **Mitigation:** Text Search Pro has 5K free/month; our primary discovery needs ~3,435 requests
- Set Google Cloud billing alerts at $25, $50, $75
- Script has `--limit`, `--dry-run`, and `--estimate` flags
- Can split discovery across 2 months for double the free cap (10K total)
- Monitor live usage in Google Cloud Console

### Risk 2: Text Search Returns Irrelevant Results
- **Mitigation:** The query "electronics recycling in {city}, {state}" is highly specific
- Gemini classification in Phase 2 filters out false positives
- Manual review of test cities before full run
- Conservative approach: only KEEP centers that Gemini classifies with >0.7 confidence

### Risk 3: Missing Legitimate Centers
- **Mitigation:** Phase 4 gap-fill runs alternative queries for cities with few results
- Cross-reference with Phase 1 classification data (centers classified as `dedicated_ewaste` but not found by discovery get flagged for manual review, not auto-deleted)
- Can supplement with known chain lookups (Best Buy, Staples locations)

### Risk 4: Gemini Hallucination in Descriptions
- **Mitigation:** Descriptions only use data from Google Places (name, type, city)
- Conservative prompt: "Do not make claims not supported by the data"
- Manual spot-check of 30+ descriptions before bulk update
- If data is limited, write 1-2 sentences only (no padding)

### Risk 5: Database Corruption
- Create full backup before any writes: `pg_dump` or Supabase export
- `--dry-run` mode for testing all phases
- Soft-delete only (never hard-delete existing entries)
- `discovery_batch` column tracks which run made each change for rollback
- Upsert with conflict handling on `google_place_id`

### Risk 6: Rate Limiting
- Built-in delays between API calls (200ms for Text Search, 500ms for Gemini)
- Stay under Gemini free tier (1,500 req/day)
- Text Search has 600 QPM (queries per minute) default quota -- more than enough
- Exponential backoff on 429 errors
- Progress saves after each city for resume

### Risk 7: Script Failure Mid-Process
- Progress tracked in `data/discovery_progress.json`
- `--resume` flag picks up from last completed city
- Results saved incrementally after each city
- Can re-run any phase independently

---

## Implementation Checklist

### Prerequisites
- [x] Supabase database with `recycling_centers` table
- [x] Environment variables configured (GOOGLE_PLACES_API_KEY, GEMINI_API_KEY, Supabase keys)
- [x] Phase 1 Gemini classification complete (28,132 centers classified)
- [ ] Enable **Places API (New)** in Google Cloud Console (may need activation)
- [ ] Run schema migration to add new columns (google_place_id, business_status, etc.)
- [ ] Set Google Cloud billing alerts ($25, $50, $75)
- [ ] Create full database backup

### Phase 1: Test Discovery (1 day)
- [ ] Create discovery script (`scripts/discover-recycling-centers.js`)
- [ ] Run Text Search on 5 test cities
- [ ] Manually review all results for relevance
- [ ] Verify data quality (address, phone, hours accuracy)
- [ ] Confirm $0 cost in Google Cloud Console

### Phase 2: Full Discovery -- Text Search Pro (1-2 days)
- [ ] Run Phase 1 on all 3,235 cities
- [ ] Monitor progress and API usage in Google Cloud Console
- [ ] Verify staying within 5K free cap
- [ ] Review discovery summary stats (total centers found, per-city distribution)
- [ ] Deduplicate results by `google_place_id`

### Phase 3: Classification & Descriptions -- Gemini (2-3 days)
- [ ] Run Gemini classification on all discovered centers (batches of 50)
- [ ] Review classification distribution (how many per type?)
- [ ] Filter out `not_ewaste` entries
- [ ] Generate unique descriptions for ALL `keep = true` centers (batches of 10)
- [ ] Extract `accepted_items` and `services_offered` (batches of 20)
- [ ] Spot-check 30 descriptions for factual accuracy and uniqueness
- [ ] Verify no template descriptions remain

### Phase 4: Contact Info -- Place Details Pro (1 day or spread across months)
- [ ] Fetch Place Details Pro for all confirmed "keep" centers
- [ ] Monitor Place Details Pro usage against 5K free cap
- [ ] If budget mode: batch into 5K/month chunks
- [ ] Verify phone numbers, websites, and hours are populated

### Phase 5: Database Reconciliation (1 day)
- [ ] Run reconciliation in dry-run mode first
- [ ] Review reconciliation report (matches, new, flagged)
- [ ] Spot-check 30 matches for correctness
- [ ] Execute reconciliation (update, insert, soft-delete)
- [ ] Verify every kept center has: name, address, city, state, lat/lng, description, center_type
- [ ] Verify >80% of kept centers have: phone, website, working_hours, rating
- [ ] Update `recycling_center_count` on cities table

### Phase 6: Gap-Fill & QA (1-2 days)
- [ ] Identify cities with 0 or very few results
- [ ] Run alternative queries for gap cities (next month's free cap)
- [ ] Random sample 100 centers from final database
- [ ] Manually verify 30 for accuracy
- [ ] Confirm all descriptions are unique (no templates)
- [ ] Document systematic issues
- [ ] Calculate final accuracy metrics

### Phase 7: Cleanup
- [ ] Remove or archive old classification data files
- [ ] Update site content if center counts changed significantly
- [ ] Trigger cache revalidation for affected city pages
- [ ] Document final statistics and lessons learned

---

## Success Metrics

### Technical
- Discovery coverage: >90% of cities have at least 1 result
- Classification accuracy: >90%
- Reconciliation match rate: >60% of existing legitimate entries found
- Total cost: <$35 (target: $0)
- Processing time: <7 days

### Data Quality -- Field Coverage Targets
- `google_place_id`: **100%** of centers (required for all entries)
- `business_status`: **100%** (from Text Search Pro)
- `name`: **100%** (from Text Search Pro)
- `full_address`: **100%** (from Text Search Pro)
- `city`, `state`, `postal_code`: **100%** (parsed from `addressComponents`)
- `latitude`, `longitude`: **100%** (from Text Search Pro)
- `description`: **100%** unique, factual (from Gemini -- NO templates)
- `center_type`: **100%** (from Gemini classification)
- `is_legitimate`: **100%** (from Gemini keep/reject decision)
- `verified_at`, `verification_source`: **100%** (set during reconciliation)
- `accepted_items`: **>70%** (from Gemini inference based on name + type)
- `services_offered`: **>50%** (from Gemini inference)
- `phone`: **>80%** (from Place Details Pro -- not all businesses list phone)
- `site` (website): **>70%** (from Place Details Pro -- smaller businesses may lack websites)
- `working_hours`: **>60%** (from Place Details Pro -- some businesses don't set hours on Google)
- `rating`: **>80%** (from Place Details Pro -- not all have enough reviews for a rating)
- `reviews` (count): **>80%** (from Place Details Pro)
- `photo`: **>50%** (from Text Search photo references; fetching actual images is optional $7/1K)
- `certifications`: **>10%** (only set when clearly indicated -- most businesses don't list these on Google)

### Business Impact
- Better SEO from unique, accurate descriptions
- Higher user trust from verified, current data
- Lower bounce rate from relevant, operational listings
- Foundation for future features (filtering by accepted items, services, etc.)
- Easy annual refresh: just re-run the discovery script

---

## Timeline

### Fast Mode (~$119 total, ~7-9 days)

```
Day 1:     Enable APIs, run migration, create script, test on 5 cities
Day 2-3:   Phase 1: Run Text Search Pro across all 3,235 cities
Day 3-5:   Phase 2: Gemini classification, descriptions, accepted items (1,500 req/day limit)
Day 5-6:   Phase 1.5: Place Details Pro for ~12,000 confirmed centers
Day 7:     Phase 3: Database reconciliation (dry-run first, then live)
Day 8:     Phase 4: Gap-fill discovery for sparse cities
Day 9:     QA, spot-checks, cleanup, documentation
```

### Budget Mode (~$0 total, ~3 months)

```
Month 1, Week 1:   Phase 1: Text Search Pro (3,435 requests, free)
Month 1, Week 1-2: Phase 2: Gemini classification + descriptions (free)
Month 1, Week 2:   Phase 1.5: Place Details Pro batch 1 (5,000 centers, free)
Month 1, Week 3:   Phase 3: Database reconciliation for batch 1
Month 2, Week 1:   Phase 1.5: Place Details Pro batch 2 (5,000 centers, free)
Month 2, Week 1:   Phase 3: Database reconciliation for batch 2
Month 3, Week 1:   Phase 1.5: Place Details Pro batch 3 (remaining, free)
Month 3, Week 1:   Phase 3: Final reconciliation
Month 3, Week 2:   Phase 4: Gap-fill + QA
```

---

## Future: Annual Refresh Process

The discovery script is designed to be re-run periodically:

1. **Quarterly spot-check:** Re-run on 200 random cities, compare with DB
2. **Annual full refresh:** Re-run on all 3,235 cities (cost: $0 within free tier)
3. **On-demand:** Re-run for specific cities/states as needed
4. **User-reported issues:** Re-verify individual centers via Place Details

Because we store `google_place_id`, future runs can efficiently detect:
- New businesses that opened
- Businesses that closed (`business_status` change)
- Updated contact info (phone, website, hours)
- Rating/review changes

Annual cost for maintenance:
- **Text Search refresh:** $0 (within 5K free/month)
- **Place Details refresh:** $0 if spread across 3 months (5K free/month)
- **Gemini re-descriptions:** $0 (free tier)
- **Total annual maintenance: $0** if patient, ~$119 if done in one month.
