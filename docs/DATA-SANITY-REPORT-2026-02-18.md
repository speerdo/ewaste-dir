# Data Sanity Report — RecycleOldTech Pipeline
**Generated:** 2026-02-18
**Analyst:** Claude Sonnet 4.6
**Scope:** Full audit of discovery, classification, and details pipeline data before script 3 (fetch-details) and script 4 (reconcile/upload)

---

## Executive Summary

The pipeline data is **in reasonably good shape but has several issues that must be fixed before running script 4**. The two blockers are:

1. **24 foreign (non-US) records** contaminating the dataset — must be removed
2. **20 duplicate google_place_ids** — must be deduplicated

Additionally, **script 3 (fetch-details) has only processed 17 records** and must be run on the full 19,349-center dataset before reconciliation.

---

## Current Pipeline Status

| Stage | Script | Status | Records |
|-------|--------|--------|---------|
| Discovery | `1-discover.js` | ✅ Complete | 28,582 places found |
| Classification | `2-classify.js` | ✅ Complete | 19,349 kept / 9,233 filtered |
| Cleanup | `2b-cleanup.js` | ✅ Complete | 402 removed, 447 type-changed |
| Fetch Details | `3-fetch-details.js` | ❌ Not run | 17/19,349 (0.1%) |
| Reconcile/Upload | `4-reconcile.js` | ❌ Not run | 0 |

**Discovery:** 3,234 cities searched, 28,582 unique places found, 0 errors.
**Classification:** 28,582 discovered → 19,349 kept (32.3% filter rate). Gemini made 1,096 calls with 26 errors.
**Fetch Details:** Only a 17-record test run completed. **This is the blocking next step.**

---

## Confirmed Data Issues

### CRITICAL — Must Fix Before Upload

#### Issue 1: 24 Foreign (Non-US) Records
**Severity: CRITICAL**
**Count: 24 records**

Records from outside the US/territories slipped into the dataset, likely because Google searches for US border cities returned results from nearby foreign cities (Windsor, ON near Detroit, MI; Niagara Falls, ON near Niagara Falls, NY; Matamoros, MX near Brownsville, TX).

| Country/Region | Records | State Value | Notes |
|---|---|---|---|
| Canada (Ontario) | 14 | `Ontario` | Windsor (4), Niagara area (5), others (5) |
| England | 3 | `England` | Household waste recycling centres |
| Mexico (Tamaulipas) | 2 | `Tamaulipas` | Matamoros, Nuevo Laredo |
| Canada (Newfoundland) | 1 | `Newfoundland and Labrador` | |
| Canada (BC) | 1 | `British Columbia` | |
| India (Punjab) | 1 | `Punjab` | Coordinates: 30.86°N, 75.99°E |
| Australia (NSW) | 1 | `New South Wales` | Coordinates: −32.88°S (southern hemisphere) |
| Wales | 1 | `Wales` | |
| Germany | 1 | `Baden-Württemberg` | |
| Ireland | 1 | `County Roscommon` | |

**Detection signals:** non-US `state` values; coordinates outside US bounds (18–72°N, -180° to -65°W); non-US postal code formats (alphanumeric Canadian, UK, 6-digit Indian).

**Fix:** Filter records where `state` is not in the list of 50 US states + DC + PR + US territories before running script 4.

---

#### Issue 2: 20 Duplicate google_place_ids
**Severity: CRITICAL**
**Count: 20 records (10 pairs)**

10 Google Place IDs appear exactly twice in the classification results. These are true duplicates — the same physical business appeared in searches for two different nearby cities and both records survived deduplication.

Sample duplicate pairs:
```
ChIJy6yLHG7E2YgRqANsRdndmC0  (×2)
ChIJAQAAVXDD2YgR1xsntJXz_tw  (×2)
ChIJ70_kVVXB2YgRr3jndbXugkk  (×2)
... and 7 more pairs
```

**Fix:** Before script 4, deduplicate `classification/results.json` on `google_place_id`, keeping the first occurrence of each.

---

### SHOULD FIX — Before or During Upload

#### Issue 3: 26 Closed Businesses in "Keep" List
**Severity: HIGH**
**Count: 25 permanently closed + 1 temporarily closed**

The classification pipeline did not filter on `business_status`, so permanently closed businesses were kept. Examples:
- Arizona Complete Electronic (ACE) Recycling — Tolleson, AZ — `CLOSED_PERMANENTLY`
- Res Electronics Recycling — San Luis Obispo, CA — `CLOSED_PERMANENTLY`
- VMMM Electronic Recycling Center Cape Coral — Estero, FL — `CLOSED_PERMANENTLY`
- eWasteNot WantNot Computer & Electronics Recycling — Zeeland, MI — `CLOSED_PERMANENTLY`
- CJD E-Store — East Alton, IL — `CLOSED_TEMPORARILY`

**Fix:** Script 4 should exclude (or flag) records where `business_status !== 'OPERATIONAL'`. The strategy doc supports soft-deletion: set `business_status = 'CLOSED_PERMANENTLY'` in DB rather than hard-delete.

---

#### Issue 4: 8 "not_ewaste" Records in the Keep List
**Severity: HIGH**
**Count: 8 records**

Eight records classified as `center_type: not_ewaste` were not removed from `results.json` — they should have been filtered out. The 2b-cleanup.js removed ~8,807 not_ewaste records, but 8 remained.

**Fix:** Script 4 should skip records where `center_type === 'not_ewaste'` OR run a cleanup pass on results.json to remove them.

---

### DATA QUALITY — Monitor / Lower Priority

#### Issue 5: 2,170 "uncertain" Centers Kept (11.2%)
**Severity: MEDIUM**
**Count: 2,170 records**

Per the original design, `uncertain` centers should be soft-deleted. Instead, they were kept in results.json. These are centers where Gemini couldn't confidently determine the type (e.g., a business named "Recycling Center" with only generic Google types).

**Options:**
- **Exclude** them (per original design) — reduces dataset by 11.2%
- **Include** them with lower `legitimacy_score` and `is_suspicious = true`
- **Reclassify** using `--retry-flagged` with more context

**Recommendation:** Include them but set `is_suspicious = true` and `legitimacy_score < 50` in the DB to let the site filter if needed.

---

#### Issue 6: 245 Template-Like Descriptions (~1.3%)
**Severity: MEDIUM**
**Count: 245 records**

Despite Gemini generating unique descriptions, 245 still contain template-like generic language. Sample problematic descriptions:
- *"They likely offer comprehensive e-waste solutions."* — speculative filler
- *"Such facilities typically offer comprehensive recycling services..."* — generic template
- *"Their primary service involves the responsible processing of various electronic waste materials."* — vague boilerplate

**Fix options:**
1. Run `--retry-flagged` on these 245 records with a stricter prompt
2. Accept them as-is (minor quality issue, not factually wrong)
3. Filter with a regex and regenerate in a targeted batch

---

#### Issue 7: 73 Duplicate Descriptions
**Severity: LOW**
**Count: 73 records**

73 records share descriptions with at least one other record. The majority are ecoATM kiosks, which Gemini described similarly because they're literally the same machine type across different locations. Top duplicates:

```
"ecoATM operates automated kiosks that provide instant cash..."  ×6
"ecoATM provides automated kiosk services for trading in..."     ×5
"ecoATM operates automated kiosks that provide instant cash..."  ×5
```

This is **expected behavior for chain locations** — not a bug. Gemini correctly identified them as the same service type. The duplication is semantic, not a data error.

**Recommendation:** Accept as-is. Only 16 unique businesses are involved (all ecoATM).

---

#### Issue 8: 3 Missing Descriptions
**Severity: LOW**
**Count: 3 records**

Three records have `null` or empty description fields. These slipped through the describe step (likely a Gemini API error on that batch).

**Fix:** Identify these 3 records and run a targeted Gemini describe call, or script 4 can skip them and let them get a null description in the DB.

---

#### Issue 9: certifications Coverage at 2.9%
**Severity: LOW (vs. spec)**
**Count: 566/19,349 have any certification**

The spec targets >10% certification coverage. Likely this reflects reality — most small recyclers and retail drop-off locations don't advertise R2/e-Stewards certs on Google Places. The 2.9% that do have certs are probably accurate. This is a data limitation, not a pipeline bug.

---

## Field Coverage Matrix

All fields checked against the 19,349 records in `classification/results.json`:

| Field | DB Column | Coverage | Status |
|-------|-----------|----------|--------|
| `google_place_id` | `google_place_id` | 100.0% | ✅ |
| `name` | `name` | 100.0% | ✅ |
| `formatted_address` | `full_address` ⚠️ | 100.0% | ✅ (rename needed) |
| `city` | `city` | 100.0% | ✅ |
| `state` | `state` | 100.0% | ✅ (24 foreign to remove) |
| `postal_code` | `postal_code` | 100.0% | ✅ (21 non-US formats) |
| `latitude` | `latitude` | 100.0% | ✅ (9 outside US bounds) |
| `longitude` | `longitude` | 100.0% | ✅ |
| `business_status` | `business_status` | 100.0% | ✅ (26 closed) |
| `center_type` | `center_type` | 100.0% | ✅ |
| `description` | `description` | 99.98% (3 missing) | ⚠️ |
| `photo_reference` | `photo` | 86.2% | ✅ (within spec) |
| `accepted_items` | `accepted_items` | 93.5% | ✅ |
| `services_offered` | `services_offered` | 93.7% | ✅ |
| `certifications` | `certifications` | 2.9% | ⚠️ (below 10% target) |
| `phone` | `phone` | — | ❌ Script 3 not run |
| `site` | `site` | — | ❌ Script 3 not run |
| `working_hours` | `working_hours` | — | ❌ Script 3 not run |
| `rating` | `rating` | — | ❌ Script 3 not run |
| `reviews` | `reviews` | — | ❌ Script 3 not run |

**Key field name mismatch:** `results.json` uses `formatted_address` but DB schema uses `full_address`. Script 4 must map this correctly. (Confirmed: `center_type` is correctly named snake_case in both places.)

---

## center_type Distribution

| Type | Count | % | Assessment |
|------|-------|---|------------|
| `retail_dropoff` | 5,680 | 29.4% | ✅ Best Buy, Staples, etc. — expected |
| `municipal` | 3,441 | 17.8% | ✅ Government programs — reasonable |
| `dedicated_ewaste` | 3,150 | 16.3% | ✅ Core audience — core value |
| `uncertain` | 2,170 | 11.2% | ⚠️ Should be flagged/reviewed |
| `repair_with_recycling` | 2,423 | 12.5% | ✅ Computer repair shops — reasonable |
| `scrap_metal` | 1,830 | 9.5% | ⚠️ May accept electronics but primary is metal |
| `itad` | 647 | 3.3% | ✅ Business-focused IT recyclers |
| `not_ewaste` | 8 | 0.04% | ❌ Should be excluded before upload |

---

## business_status Distribution

| Status | Count | % |
|--------|-------|---|
| `OPERATIONAL` | 19,323 | 99.9% |
| `CLOSED_PERMANENTLY` | 25 | 0.13% |
| `CLOSED_TEMPORARILY` | 1 | 0.005% |

---

## Discovery → Classification Reconciliation

| Metric | Value |
|--------|-------|
| Discovery total | 28,582 |
| Classification kept | 19,349 |
| Filtered out | 9,233 (32.3%) |
| Orphaned IDs (in classified but not discovery) | 0 ✅ |
| Duplicate place IDs in classified | 20 ⚠️ |

The 20-record discrepancy between "9,233 filtered" and "9,253 unique IDs not in classified" is explained exactly by the 20 duplicate place IDs adding 20 extra records beyond the unique count. This is internally consistent.

**Sample filtered-out records (correctly removed):**
- Republic Services (general waste — not e-waste)
- Sand Mountain Recycling (general recycling)
- Center of Hope Thrift Store (thrift — not e-waste)
- Redhot Recycling (auto parts)
- Meridian Waste (general waste hauler)

The classification step appears to be correctly filtering general recyclers, waste haulers, and non-electronics businesses.

---

## Geographic Distribution

**Top 5 states by center count:**
1. Texas — 1,572
2. California — 1,239
3. Florida — 1,199
4. North Carolina — 897
5. New York — 845

**Cities:** 4,833 unique cities in results vs. 3,235 cities searched. The 1,598 extra cities are expected — a search for city A returns businesses whose `formattedAddress` city is a nearby city B.

**Cities with only 1 center:** 1,946 (40.2% of cities). These are likely small towns where only one option was found — reasonable.

---

## Accepted Items & Services Coverage

**Accepted Items (from 18,092 records with non-empty list):**
| Item | Count | % of all |
|------|-------|----------|
| phones | 15,627 | 80.8% |
| tablets | 15,177 | 78.4% |
| laptops | 14,424 | 74.5% |
| computers | 14,176 | 73.3% |
| monitors | 13,505 | 69.8% |
| cables | 13,319 | 68.8% |
| printers | 12,658 | 65.4% |
| batteries | 12,057 | 62.3% |
| small_appliances | 10,712 | 55.4% |
| tvs | 9,928 | 51.3% |
| crt_monitors | 8,613 | 44.5% |
| networking_equipment | 6,601 | 34.1% |
| servers | 6,500 | 33.6% |
| copiers | 6,252 | 32.3% |

**Services (from 18,123 records with non-empty list):**
| Service | Count | % of all |
|---------|-------|----------|
| free_dropoff | 16,004 | 82.7% |
| residential_services | 12,396 | 64.1% |
| business_services | 6,407 | 33.1% |
| pickup | 5,751 | 29.7% |
| data_destruction | 5,637 | 29.1% |
| paid_dropoff | 2,703 | 14.0% |
| onsite_shredding | 602 | 3.1% |
| mail_in | 186 | 1.0% |

**Assessment:** Distribution looks realistic. `free_dropoff` at 82.7% is plausible given municipal programs + retail drop-offs. `mail_in` at 1.0% matches the niche nature of mail-in programs.

**Concern:** Gemini may be over-inferring. With 80%+ of centers accepting phones and tablets, and 82% offering free drop-off, there's a risk these were inferred too liberally from the business name alone. Spot-checking a random sample before upload is recommended.

---

## Pre-Upload Checklist

### Blocking (must complete before script 4)

- [ ] **Run script 3 (fetch-details)** on all 19,349 keep centers
  - Estimated: ~3-4 days across days (Gemini rate limits don't apply; this is Places API)
  - Free cap: 5,000/month for Place Details Pro
  - Consider spreading across months to stay $0

- [ ] **Remove 24 foreign records** from classification/results.json
  - Filter: `state` not in US states + DC + PR list
  - Or filter: `latitude` outside [18, 72] AND `longitude` outside [-180, -65]

- [ ] **Deduplicate 20 duplicate google_place_ids** in classification/results.json
  - Keep first occurrence of each duplicate pair

- [ ] **Verify script 4 maps `formatted_address` → `full_address`**
  - Check `4-reconcile.js` field mapping before running

### Recommended (fix before or handle in script 4)

- [ ] Exclude 8 `not_ewaste` records (or add exclusion logic to script 4)
- [ ] Exclude 26 `CLOSED_PERMANENTLY/TEMPORARILY` businesses (or soft-flag in DB)
- [ ] Decide on 2,170 `uncertain` centers: exclude, include with `is_suspicious=true`, or reclassify
- [ ] Run targeted Gemini describe call for 3 records with missing descriptions

### Post-Upload QA

- [ ] Spot-check 50 random centers against their Google Maps listing
- [ ] Verify phone numbers are real for a sample of 20 centers
- [ ] Confirm no template descriptions in the live DB
- [ ] Check that `google_place_id` is unique in the DB (DB-level constraint recommended)
- [ ] Verify foreign record exclusion was successful (no Canadian/UK postal codes in DB)
- [ ] Validate center counts per state match expected distribution

---

## Memory.md Updates Needed

The MEMORY.md extract progress figure is outdated:
- **Memory says:** `extract 15.8% (3,060/19,349)`
- **Actual data:** `accepted_items` non-empty on 18,092/19,349 = **93.5%**

The extract step ran to near-completion (likely to the Gemini daily limit cutoff, then resumed). Update MEMORY.md to reflect current status.

---

## Recommended Next Steps (Priority Order)

1. **Run script 3** (`3-fetch-details.js`) — this is the main blocking step
2. **Fix the 24 foreign records** — write a small cleanup script or filter in script 4
3. **Fix the 20 duplicates** — 10 lines of dedup logic before script 4
4. **Run script 4 dry-run** (`4-reconcile.js --dry-run`) — review reconciliation report
5. **Run script 4 live** — after verifying dry-run output
6. **Post-upload spot-check** — manually verify 50 random centers

---

*Report based on manual analysis of `data/discovery/results.json` (28,582 records, 28 MB), `data/classification/results.json` (19,349 records, 33 MB), and `data/details/results.json` (17 records, test only). Scripts analyzed: 1-discover.js, 2-classify.js, 2b-cleanup.js, 3-fetch-details.js, 4-reconcile.js.*
