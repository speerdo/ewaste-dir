# RecycleOldTech Data Verification Strategy

## Project Context
RecycleOldTech.com is an electronics recycling directory that needs automated venue verification. This document outlines the strategy for verifying existing data and discovering missing centers.

**Current Database State (as of Feb 2026):**
- **28,521 recycling centers** across 51 states and 3,235 cities
- 99.6% have descriptions (but most are generic templates, not factual)
- 86.4% have websites, 96.5% have phone numbers, 87.4% have ratings
- 92.2% marked legitimate, 4.0% marked suspicious
- Scraped June-July 2025 (7-8 months old, needs freshness check)

**Core Problem:**
Existing descriptions are auto-generated templates ("Specialized electronics retailer offering comprehensive recycling services...") rather than factual descriptions of what each center actually does. Many entries may be computer repair shops, phone repair stores, or other businesses that don't primarily offer e-waste recycling.

**Goals:**
1. Verify which centers are actually e-waste recyclers (vs. repair shops, retail stores, etc.)
2. Discover centers we may have missed
3. Generate accurate, factual descriptions
4. Update the database with verified data
5. Minimize API costs while maximizing accuracy

**Budget Constraint:** Minimize cost. Accuracy is the top priority.

---

## Available API Keys & Environment Variables

```bash
# Available (from .env.example)
PUBLIC_SUPABASE_URL=           # Supabase project URL
PUBLIC_SUPABASE_ANON_KEY=      # Supabase anon key (read-only)
PUBLIC_SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role (read/write)
PUBLIC_GOOGLE_MAPS_API_KEY=    # Google Maps API key
GOOGLE_PLACES_API_KEY=         # Google Places API key (for Text Search, Find Place, Place Details)
GEMINI_API_KEY=                # Google Gemini AI key (free tier: 1,500 req/day)
REVALIDATION_TOKEN=            # Cache revalidation token
```

**NOT available:** Google Custom Search API key, Google Search Engine ID. Discovery must use Google Places Text Search API instead.

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
| updated_at | timestamptz | Last update time |

**Note:** The `DATABASE_SCHEMA.md` documents additional columns (`accepted_items`, `services_offered`, `certifications`, `content_enhanced`, etc.) that have NOT been created via migration yet. We will add them as part of this verification effort.

### Schema Migration Needed

Before running verification, apply this migration to add structured data columns:

```sql
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS accepted_items jsonb DEFAULT '[]';
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS services_offered jsonb DEFAULT '[]';
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]';
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS center_type text;
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE recycling_centers ADD COLUMN IF NOT EXISTS verification_source text;
```

**Column purposes:**
- `accepted_items` - JSON array of accepted electronics: `["computers", "tvs", "monitors", "phones", "printers", "batteries"]`
- `services_offered` - JSON array of services: `["data_destruction", "pickup", "free_dropoff", "onsite_shredding", "business_services"]`
- `certifications` - JSON array: `["R2", "e-Stewards", "NAID", "ISO 14001"]`
- `center_type` - Classification: `"dedicated_ewaste"`, `"retail_dropoff"`, `"repair_with_recycling"`, `"scrap_metal"`, `"municipal"`, `"itad"`
- `verified_at` - When this center was last verified
- `verification_source` - How it was verified: `"gemini_classify"`, `"places_api"`, `"manual"`

---

## The Four-Phase Verification Strategy

### Phase 1: AI Classification (Gemini - FREE)
**Goal:** Classify all 28,521 centers by name/description without any paid API calls.

**Method:**
- Batch center names (50 at a time) through Gemini Flash
- Classify each as: `dedicated_ewaste`, `repair_with_recycling`, `retail_dropoff`, `scrap_metal`, `municipal`, `itad`, `not_ewaste`, `uncertain`
- This is a fast, free pre-screen that identifies which centers need expensive API verification

**Cost:** $0 (Gemini Flash free tier: 1,500 requests/day)
**Time:** ~570 batches of 50 = 570 requests. Well within daily limit, completable in a few hours.

**Why this phase matters:** At $0.017-$0.032 per Places API call, verifying all 28,521 centers would cost $485-$913. By classifying with Gemini first, we only pay for API verification on the ~2,000-4,000 uncertain/suspicious centers.

### Phase 2: Google Places Verification (Targeted)
**Goal:** Verify centers that Gemini flagged as uncertain or suspicious.

**Method:**
1. Use Find Place API ($0.017/req) with `name + city + state` to confirm existence
2. Check `business_status` - skip permanently closed
3. For surviving candidates, use Place Details ($0.017/req) to get reviews
4. Feed reviews back to Gemini for e-waste confirmation

**Targets:** Only centers classified as `uncertain`, `not_ewaste` (to confirm removal), or `is_suspicious = true`
**Estimated volume:** ~3,000-5,000 centers
**Cost:** ~$50-$85 (Find Place) + ~$30-$50 (Place Details for uncertain) = ~$80-$135

### Phase 3: Discovery (Find Missing Centers)
**Goal:** Find e-waste centers not in our database.

**Method:**
- Use Google Places Text Search API ($0.032/req)
- Search "electronics recycling" in each city where we have centers
- Deduplicate against existing database by name similarity + address proximity
- New finds go through Phase 2 verification

**Approach:** Start with top 200 cities by population, expand later.
**Cost:** 200 cities × ~3 queries = 600 × $0.032 = ~$19
**Note:** We do NOT have Google Custom Search API keys. All discovery uses Places Text Search API.

### Phase 4: Enrichment & Database Update
**Goal:** Generate accurate descriptions and update the database.

**Method:**
1. For verified centers, generate factual 2-3 sentence descriptions with Gemini
2. Extract `accepted_items`, `services_offered`, `certifications` from reviews/data
3. Set `center_type` classification
4. Upsert to Supabase

**Cost:** $0 (Gemini free tier)

---

## Cost Analysis

### Budget Mode (recommended - 7-10 days)

```
Phase 1 - AI Classification:     $0.00 (Gemini free tier)
Phase 2 - Places Verification:   ~$80-$135 (3,000-5,000 API calls)
Phase 3 - Discovery:             ~$19 (top 200 cities)
Phase 4 - Enrichment:            $0.00 (Gemini free tier)
─────────────────────────────────
Total estimate:                   ~$100-$155
```

**Daily limits to stay under free tiers:**
- Gemini: 1,500 requests/day (FREE) - process ~500 centers/day at batch size 50
- Places API: No free tier, but budget by limiting to $15-20/day

### Fast Mode (2-3 days, ~same cost but higher daily spend)

Same total cost, just compressed into fewer days by running more API calls per day.

### API Pricing Reference

| API | Cost | Free Tier |
|-----|------|-----------|
| Gemini 2.0 Flash | $0 | 1,500 req/day |
| Google Find Place | $0.017/req | None |
| Google Place Details (Basic) | $0.017/req | None |
| Google Text Search | $0.032/req | None |

---

## Implementation: Single Unified Script

Instead of 5 separate scripts, we use one script with phase flags for simplicity and resumability.

### File Structure
```
scripts/
└── verify-recycling-centers.js   # The unified verification script

data/
├── verification_progress.json    # Progress tracking (auto-generated)
├── classification_results.json   # Phase 1 results (auto-generated)
├── verification_results.json     # Phase 2 results (auto-generated)
├── discovery_results.json        # Phase 3 results (auto-generated)
└── verification_summary.json     # Final summary (auto-generated)
```

### CLI Usage
```bash
# Run all phases (recommended for first run)
node scripts/verify-recycling-centers.js

# Run specific phases
node scripts/verify-recycling-centers.js --phase classify      # Phase 1 only
node scripts/verify-recycling-centers.js --phase verify        # Phase 2 only
node scripts/verify-recycling-centers.js --phase discover      # Phase 3 only
node scripts/verify-recycling-centers.js --phase enrich        # Phase 4 only

# Limit scope for testing
node scripts/verify-recycling-centers.js --phase classify --limit 100
node scripts/verify-recycling-centers.js --phase classify --state "Indiana"
node scripts/verify-recycling-centers.js --phase classify --city "Indianapolis"

# Dry run (no database writes)
node scripts/verify-recycling-centers.js --dry-run

# Resume from last progress
node scripts/verify-recycling-centers.js --resume
```

---

## Gemini Prompts

### Phase 1: Classification Prompt

```
You are classifying recycling centers for an electronics recycling directory.
For each business name below, determine its likely type.

TYPES:
- dedicated_ewaste: Dedicated e-waste/electronics recycling facility
- repair_with_recycling: Computer/phone repair that also recycles
- retail_dropoff: Retail store with recycling program (Best Buy, Staples, etc.)
- scrap_metal: Scrap metal dealer that may accept electronics
- municipal: Government/municipal recycling program
- itad: IT Asset Disposition company (business-focused)
- not_ewaste: NOT an electronics recycler (junk removal, clothing donation, etc.)
- uncertain: Cannot determine from name alone

BUSINESS NAMES:
{names as JSON array}

Return a JSON array of objects: [{"name": "...", "type": "...", "confidence": 0.0-1.0}]
Only return the JSON, no other text.
```

### Phase 2: Verification Prompt (batch of 5)

```
You are verifying whether these businesses accept electronic waste for recycling.
Based on the Google Places data (reviews, business types), determine:

1. decision: KEEP (accepts e-waste), REMOVE (not e-waste), UNCERTAIN
2. center_type: dedicated_ewaste, repair_with_recycling, retail_dropoff, scrap_metal, municipal, itad
3. accepted_items: array of items accepted (computers, tvs, monitors, phones, printers, batteries, small_appliances, crt_monitors)
4. services: array of services (data_destruction, pickup, free_dropoff, onsite_shredding, business_services, residential_services)
5. certifications: array if mentioned (R2, e-Stewards, NAID, ISO_14001)
6. charges_fee: true/false/null
7. fee_info: string description of fees or null

ONLY set flags that are clearly supported by the data. Use null for unknown.

VENUES:
{venue data as JSON}

Return JSON array: [{"name": "...", "decision": "KEEP", "center_type": "...", "accepted_items": [...], ...}]
```

### Phase 4: Description Generation Prompt

```
Write a concise, factual 2-3 sentence description for {NAME},
an electronics recycling center in {CITY}, {STATE}.

CONTEXT:
- Classification: {center_type}
- Accepted items: {accepted_items}
- Services: {services}
- Certifications: {certifications}
- Reviews: {review_excerpts}

RULES:
- Sentence 1: What they accept and primary service
- Sentence 2: Key differentiators (data destruction, pickup, certifications)
- Sentence 3 (optional): Fees or restrictions if known
- DO NOT use marketing language ("best", "leading", "top-rated")
- DO NOT include hours, phone, or address (displayed separately on the page)
- DO NOT make claims not supported by the data
- Tone: Professional, factual, helpful

Return only the description text.
```

---

## Testing Strategy

### Step 1: Small Test (50-100 centers)
**Goal:** Validate classification accuracy before running on full dataset.

1. Run Phase 1 on 100 centers: `--phase classify --limit 100`
2. Manually review 20-30 classifications
3. Calculate accuracy (target: >85%)
4. Tune prompt if needed

### Step 2: Verification Test (1-2 cities)
**Goal:** Validate end-to-end flow with actual API calls.

**Test cities:**
- 1 large city (50+ centers): Indianapolis or Phoenix
- 1 small city (5-10 centers): Bloomington or Fort Wayne

1. Run Phase 2 on test cities: `--phase verify --city "Indianapolis"`
2. Manually spot-check 15-20 results
3. Verify Place API data matches reality
4. Check Gemini's e-waste verification accuracy

### Step 3: Description Quality Check
**Goal:** Ensure descriptions are factual and useful.

1. Run Phase 4 on 20-30 verified centers
2. Compare generated descriptions against:
   - Center's actual website
   - Google reviews
   - Current template description
3. Descriptions should be specific, not generic

**Success Criteria:**
- Classification accuracy: >85%
- Verification decision accuracy: >90%
- Description quality: specific and factual (not template)
- No false "KEEP" for non-recycling businesses
- Cost within budget

---

## Decisions Made

### 1. Include Retail Drop-Off Programs? **YES**
Include Best Buy, Staples, etc. but classify as `retail_dropoff` center_type. These are useful for users and generate good SEO value. Display them separately or with a badge on the site.

### 2. How to Handle UNCERTAIN Venues? **Second Pass + Manual Review**
- Run a second Gemini analysis with a different prompt angle
- If still uncertain after two passes, flag for manual review
- Only REMOVE if both passes agree on REMOVE

### 3. Discovery Script? **YES, after verification**
Run discovery (Phase 3) after verifying existing data. Focus on top 200 cities first. Use Places Text Search API since we don't have Custom Search keys.

### 4. Certification Flags? **YES, extract if mentioned**
Store in `certifications` JSONB array. Only set certifications clearly mentioned in Google reviews or business data. Use `null`/empty array if uncertain (never guess).

### 5. Batch Size? **50 for classification, 5 for verification**
- Phase 1 (Gemini classification): 50 names per batch (just names, minimal tokens)
- Phase 2 (Gemini verification): 5 venues per batch (full data, needs accuracy)

### 6. Update Frequency? **Targeted re-verification**
- Re-verify centers reported as closed by users
- Re-verify centers older than 1 year
- Annual sweep of full database (~$100-$150/year)

---

## Risk Mitigation

### Risk 1: API Cost Overrun
- Set Google Cloud billing alerts at $50, $100, $150
- Phase 1 is completely free (Gemini only)
- Budget mode: cap at $15-20/day in Places API costs
- Script has `--limit` flag for testing
- Script has `--dry-run` mode

### Risk 2: Gemini Hallucination
- Conservative prompts: "Only set flags clearly supported by data"
- Use `null` for unknown values (never guess)
- Manual spot-checks throughout process
- Second verification pass for uncertain cases
- Batch size of 5 keeps accuracy high

### Risk 3: Database Corruption
- Create full backup before production run
- `--dry-run` mode for testing
- Script logs all changes for rollback
- Never overwrite manually verified data
- Upsert with conflict handling

### Risk 4: Rate Limiting
- Built-in delays between API calls (1s for Places, 500ms for Gemini)
- Stay under Gemini free tier (1,500 req/day)
- Exponential backoff on 429 errors
- Progress saves after each batch for resume

### Risk 5: Script Failure Mid-Process
- Progress tracked in `data/verification_progress.json`
- `--resume` flag picks up where it left off
- Results saved incrementally after each batch
- Can re-run any phase independently

---

## Implementation Checklist

### Prerequisites
- [x] Supabase database with recycling_centers table
- [x] Environment variables configured (GOOGLE_PLACES_API_KEY, GEMINI_API_KEY, Supabase keys)
- [ ] Run schema migration to add new columns (accepted_items, services_offered, etc.)
- [ ] Set Google Cloud billing alerts

### Phase 1: Test (1 day)
- [ ] Create verification script
- [ ] Run classification on 100 centers
- [ ] Manually review 20-30 results
- [ ] Calculate accuracy, tune prompts if needed

### Phase 2: Classification (1-2 days)
- [ ] Run Phase 1 on full dataset (28,521 centers)
- [ ] Review summary stats (how many per type?)
- [ ] Spot-check 50 random results

### Phase 3: Verification (3-5 days)
- [ ] Run Phase 2 on suspicious/uncertain centers
- [ ] Spot-check 30 results
- [ ] Mark confirmed centers as verified

### Phase 4: Discovery (1-2 days)
- [ ] Run Phase 3 on top 200 cities
- [ ] Verify new discoveries
- [ ] Add to database

### Phase 5: Enrichment (2-3 days)
- [ ] Run Phase 4 to generate descriptions
- [ ] Review 30 descriptions for quality
- [ ] Update database with enriched data

### Phase 6: Quality Assurance
- [ ] Random sample 100 centers from final database
- [ ] Manually verify accuracy
- [ ] Document systematic issues
- [ ] Calculate final accuracy metrics

---

## Success Metrics

### Technical
- Classification accuracy: >85%
- Verification decision accuracy: >90%
- Total cost: <$155
- Processing time: <10 days (budget mode)

### Data Quality
- Unique, factual descriptions (not templates)
- Accurate center_type classification
- accepted_items populated for >70% of verified centers
- services_offered populated for >60% of verified centers
- No false "legitimate" for non-recycling businesses

### Business Impact
- Better SEO from unique descriptions
- Higher user trust from accurate data
- Lower bounce rate from relevant listings
- Foundation for future features (filtering by accepted items, services, etc.)
