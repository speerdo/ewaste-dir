# Data Quality Remediation Plan
## Post-Classification Fixes Before Database Reconciliation

_Written: Feb 25, 2026_
_Updated: Feb 25, 2026_
_Status: Scripts 1–2e complete. Descriptions clean (0% hedging). Stale removal planned._

---

## Pipeline State

| Script | Status | Output |
|--------|--------|--------|
| `1-discover.js` | ✅ Complete | 28,582 unique places, 3,234 cities searched, $0 cost |
| `2-classify.js` | ✅ Complete | 17,096 kept centers, all with descriptions + items |
| `2b-cleanup.js` | ✅ Complete | Removed chain false positives (Shred Nations, uBreakiFix, etc.) |
| `2c-cleanup.js` | ✅ Complete | Additional deterministic cleanup pass |
| `2d-overlap-report.js` | ✅ Complete | See `data/reports/overlap-report.md` |
| `2e-fix-services.js` | ✅ Complete | Fixed service conflicts + items over-assignment |
| Description re-run | ✅ Complete | 0% hedging achieved via `--retry-descriptions` + `2f-fix-descriptions.js` |
| **`5-remove-stale.js`** | 🔧 **TODO** | Remove 6,904 not_ewaste/uncertain stale records (this plan) |
| **Protected centers list** | 🔧 **TODO** | Confirm manually-updated records before reconcile |
| `3-fetch-details.js` | ⏳ Not started | Phone/website/hours for new centers (use `--new-only` to skip existing DB entries) |
| `4-reconcile.js` | ⏳ Not started | Merge discoveries into live DB |

### Current results.json
- **17,096 records** — pipeline fully finalized (no `_step` tags)
- 5,673 retail_dropoff · 3,423 municipal · 3,122 dedicated_ewaste
- 2,414 repair_with_recycling · 1,820 scrap_metal · 644 itad

### Overlap with existing DB (from 2d report, Feb 21)
- 10,439 matched existing records (100% by name+city — DB has no google_place_ids)
- 6,657 are net-new additions
- **19,107 existing DB records NOT matched** — mostly stale/wrong from June 2025 scrape

---

## Problems Found (With Numbers)

### Problem 1 — Descriptions violate the prompt's own rules (3,120 records, 18%)

The `DESCRIBE_PROMPT` in `2-classify.js` explicitly prohibits hedging language. Gemini complied poorly:

- **3,120 descriptions** contain `potentially`, `may `, `likely`, `possibly`, `could `, or `might `
- **392 descriptions** match generic template patterns (e.g., "provides a wide range of electronics recycling")

Real examples from the data:
> "...potentially including select electronics" — `municipal` Albertville Boaz Recycling Center
> "They may accept certain electronics primarily for the recovery of their metallic components." — `scrap_metal` Pacific Trading & Recycling
> "likely offer comprehensive e-waste solutions" — `dedicated_ewaste` [multiple centers]

Root cause: Gemini defaults to hedging when it has only a name + city + type to work from. The prompt said not to, but didn't give a clear fallback instruction. Fix: tighten the fallback — "if you have only a name and type, write ONE direct sentence about what kind of facility it is. Nothing more."

These descriptions are structurally unusable in their current form. A recycling directory that says "may accept electronics" for a facility called "E-Waste Recycling Center" damages credibility.

### Problem 2 — `accepted_items` is catastrophically over-assigned (3,507 records)

- **3,507 records have ALL 14 possible items** — this is not inference, it's a default
- `dedicated_ewaste` average: **13.0 items** out of 14 max
- `scrap_metal` average: **11.0 items** — a scrap yard does not trade in phones and tablets
- `municipal` average: **10.8 items**

When every center is tagged as accepting everything, the field is worthless for filtering. The `EXTRACT_PROMPT` said to "be conservative" but Gemini defaulted to maximum coverage. The fix must be deterministic (no API call needed): if a record was assigned all 14 items, reset it to the type-appropriate subset.

### Problem 3 — Fee/service conflict: 1,161 centers tagged both `free_dropoff` AND `paid_dropoff`

This is the highest trust-damage risk identified in `CRITICAL.md`:
> "free_dropoff tags on centers that actually charge — this will damage trust if users show up expecting free service"

Breakdown of the 1,161 conflicted records:
| Type | Count |
|------|------:|
| dedicated_ewaste | 996 |
| municipal | 31 |
| retail_dropoff | 20 |
| itad | 16 |
| scrap_metal | 88 |
| repair_with_recycling | 10 |

The pipeline set both because it was uncertain. The safe resolution: **remove `free_dropoff`, keep `paid_dropoff`**. Setting a lower expectation (paid) causes less harm than a broken promise (advertised free, actually paid). Fee truth will be corrected later when Place Details data is added via Script 3.

### Problem 4 — B2B centers tagged `residential_services` (affects all 644 ITAD records)

ITAD = IT Asset Disposition = enterprise-only by definition. The classification prompt defines ITAD as "business-focused data destruction and equipment recycling." Yet the extraction step added `residential_services` to many ITAD records. STS Electronic Recycling (TX) is the confirmed case from `CRITICAL.md` (Fortune 500, healthcare, government only).

Fix: strip `residential_services` and `mail_in` from all `itad` records.

### Problem 5 — Stale DB records: 6,904 `not_ewaste`/`uncertain` records to remove

Cross-referencing the DB's 8,882 `not_ewaste` (2,206) + `uncertain` (6,676) records against the new scan revealed:

- **2,191** `not_ewaste` records NOT in new scan — these are genuinely wrong entries (junk removal companies, car dealerships, national parks, hotels — confirmed by inspecting high-review examples)
- **4,713** `uncertain` records NOT in new scan — borderline businesses Google also didn't find

However, 1,978 records in these two types **were** found by the new scan and are being reclassified as legitimate keepers (the new pipeline correctly identified them).

**Tier breakdown for the 6,904 removal candidates:**

| Tier | Criteria | Count | Action |
|------|----------|------:|--------|
| 1 | `not_ewaste` (any reviews) + `uncertain` (no site, <5 reviews) | 2,736 | Hard delete |
| 2 | `uncertain` with a website, <5 reviews | 765 | HTTP HEAD check → delete dead, soft-delete live |
| 3 | `uncertain` with 5+ reviews | 3,403 | `is_legitimate=false` (hidden, keep for review) |

Tier 1 is safe with no investigation because inspection of the top-reviewed `not_ewaste` records shows businesses like "1-800-GOT-JUNK?", "Mammoth Cave National Park", "East Coast Honda", and "Holiday Inn Times Square" — all with fake template descriptions ("Electronics recycling facility providing..."). These are clearly not e-waste centers.

---

## The Fix Scripts

### Script `2e-fix-services.js` — Deterministic Data Cleanup _(No API calls)_

**What it fixes:**

**A. Service conflict resolution (1,161 records)**
- If `services_offered` contains both `free_dropoff` AND `paid_dropoff` → remove `free_dropoff`
- Rationale: false "free" promise is worse than false "paid" expectation

**B. ITAD service cleanup (644 records)**
- Remove `residential_services` from all `itad` records
- Remove `mail_in` from all `itad` records (ITAD does pickup, not mail-in)

**C. Scrap metal service cleanup**
- Remove `residential_services` from `scrap_metal` records (scrap yards are not consumer-facing drop-offs)
- Remove `mail_in` from `scrap_metal` records

**D. Accepted items reset for over-assigned records**
Only applies to records where ALL 14 items are present (the "default everything" case). Records with fewer items had actual inference done and are left alone.

Type-specific item resets:

| Type | Items After Reset | Reasoning |
|------|------------------|-----------|
| `scrap_metal` | computers, laptops, monitors, tvs, cables, crt_monitors, servers, networking_equipment, copiers | Metal-heavy electronics only; phones/tablets/batteries are not scrap metal |
| `municipal` | _(empty array)_ | Can't infer from name alone; description handles it |
| `itad` | computers, laptops, phones, tablets, monitors, servers, networking_equipment, copiers | Enterprise equipment; not consumer TVs, printers, small_appliances |
| `repair_with_recycling` | phones, tablets, laptops, computers, monitors | Only devices they repair/trade in |
| `retail_dropoff` | computers, laptops, phones, tablets, monitors, tvs, printers, batteries, cables, small_appliances | Standard consumer e-waste; not enterprise servers/networking/copiers |
| `dedicated_ewaste` | computers, laptops, phones, tablets, monitors, tvs, printers, batteries, cables, small_appliances, crt_monitors | Broad but removes B2B-specific items (servers, networking_equipment, copiers) |

**Output:** Saves updated `results.json` + `cleanup-2e-changelog.json` + backup.

---

### Description Re-Run — Fix Hedging in 3,120 Records _(~312 Gemini requests)_

**Prompt changes needed in `2-classify.js` `DESCRIBE_PROMPT`:**

1. Add explicit fallback: "If you have only a name and type (no unique details), write EXACTLY ONE sentence stating what type of facility it is. Nothing more. Do NOT pad with 'may', 'likely', or 'potentially'."
2. Add scrap_metal specific rule: "For scrap_metal: write 'accepts electronics for metal recovery value' if no unique details are known."
3. Add municipal specific rule: "For municipal: describe only what is confirmed — that it is a government/public recycling facility. Do not list accepted items unless you are certain."

**Execution:**
- Use `--retry-failed` mode logic to process only records where `description` contains hedging keywords
- Estimated: ~3,120 records / 10 per batch = 312 Gemini requests (~1 day free tier)
- Run `node scripts/2-classify.js --retry-descriptions` (new flag to add) or patch a targeted re-describe run

This is lower priority than `2e-fix-services.js` since it requires a prompt update + Gemini quota. Do after the deterministic fixes are confirmed.

---

---

## Script `5-remove-stale.js` — Tiered Stale Record Removal _(No API calls for Tier 1)_

Cross-references the live DB's `not_ewaste` and `uncertain` records against the new scan's `results.json` using normalized `name+city+state` matching. Records found in both are left alone (they were reclassified as keepers by the new pipeline).

**Tier 1 — Hard delete (2,736 records)**
- All `not_ewaste` records not in new scan (regardless of reviews) — confirmed junk entries
- `uncertain` records with no website AND <5 reviews — ghost listings with no web presence

**Tier 2 — Website health check (765 records)**
- `uncertain` records with a website URL but <5 reviews
- Script does a HEAD request per site (5s timeout)
- Dead/unreachable site → hard delete
- Live site → soft-delete (`is_legitimate=false`) for later review

**Tier 3 — Soft-delete (3,403 records)**
- `uncertain` records with 5+ reviews — borderline businesses that could be legitimate
- Sets `is_legitimate=false` (hidden from the site, preserved in DB)
- After soft-delete, review these via targeted Google re-search or manually before hard-deleting

**Output:** Full audit log saved to `data/reports/stale-removal-<timestamp>.json` listing every changed record.

```bash
# Preview counts
node scripts/5-remove-stale.js --stats

# Dry run (safe to run anytime)
node scripts/5-remove-stale.js --dry-run --all

# Incremental execution (recommended order)
node scripts/5-remove-stale.js --tier1
node scripts/5-remove-stale.js --tier2
node scripts/5-remove-stale.js --tier3
```

---

## Protected Centers (Preserve During Script 4)

Before `4-reconcile.js` soft-deletes the 19,107 unmatched DB records, these must be protected:

| Chain | Action |
|-------|--------|
| All ecoATM records in DB | Keep as-is; do NOT flag as stale |
| All Best Buy records in DB | Keep as-is |
| All Staples records in DB | Keep as-is |
| Montana manual addition | Keep as-is (need name/ID from user) |

**Implementation:** `4-reconcile.js` needs a `--protect-chains` flag or a pre-built ID list. The protection query:
```sql
SELECT id, name, city, state FROM recycling_centers
WHERE name ILIKE 'ecoATM%'
   OR name ILIKE 'Best Buy%'
   OR name ILIKE 'Staples%'
   OR (state = 'Montana' AND updated_at > '2026-01-01')  -- adjust date/name
```

Note: The new discovery already includes ecoATMs, Best Buys, and Staples from Google Places (they appear as `retail_dropoff`). So these will be matched and updated via the normal reconciliation flow. The protection is mainly for any manually-updated records that were NOT returned by Google (e.g., smaller locations, locations in low-density areas).

---

## Execution Order

```
STEP 1 ✅ DONE — Service + items cleanup
  node scripts/2e-fix-services.js

STEP 2 ✅ DONE — Description cleanup (0% hedging achieved)
  node scripts/2-classify.js --retry-descriptions
  node scripts/2f-fix-descriptions.js

STEP 3 (NOW) — Remove stale not_ewaste / uncertain records
  node scripts/5-remove-stale.js --stats              # preview (no writes)
  node scripts/5-remove-stale.js --dry-run --all      # dry run all tiers
  node scripts/5-remove-stale.js --tier1              # hard-delete 2,736 ghost records
  node scripts/5-remove-stale.js --tier2              # website-check 765 records
  node scripts/5-remove-stale.js --tier3              # soft-delete 3,403 uncertain-with-reviews

STEP 4 — Confirm protected centers + run reconciliation
  Get Montana manual addition name/ID from user
  node scripts/4-reconcile.js --dry-run               # review merge report
  node scripts/4-reconcile.js                         # apply to DB

STEP 5 — Fetch Place Details for new centers
  node scripts/3-fetch-details.js --new-only --estimate   # check cost (skips existing DB entries)
  node scripts/3-fetch-details.js --new-only --limit 100  # test on 100
  node scripts/3-fetch-details.js --new-only              # all new centers only
```

**Cost estimate:**
- Steps 1–3: $0 (no API calls)
- Step 4: $0
- Step 5 (`--new-only`): ~$28 one-shot, or $0 spread over 2 months (free tier)

---

## Success Criteria Before Script 3 Runs

- [x] Zero records with both `free_dropoff` AND `paid_dropoff`
- [x] Zero `itad` records with `residential_services`
- [x] Zero records with all 14 `accepted_items` (the "default everything" case)
- [x] Descriptions: 0% hedging rate (achieved via `--retry-descriptions` + `2f-fix-descriptions.js`)
- [ ] `5-remove-stale.js` tiers executed — 6,904 stale records addressed
- [ ] Protected centers identified and documented
- [ ] `4-reconcile.js` tested in dry-run mode

---

## What Script 3 Fixes (Not This Plan's Scope)

These issues exist but require Place Details API data to resolve:

- **Actual fee information** (Total Reclaim $0.40/lb, DLG Electronics TV fees, etc.) — Script 3 won't directly give fee data, but website URLs fetched will allow manual verification for flagged centers
- **Accurate phone/website for all 17,096 centers** — Script 3
- **Business hours** — Script 3
- **Rating/review counts** — Script 3
- **Address verification** — Current addresses from Text Search Pro are already current; Script 3 adds contact info

Fee data specifically is a known gap that no automated script can fully solve. Options post-Script-3:
1. Add a "fees may apply — verify before visiting" disclaimer to all descriptions
2. Use website URLs from Script 3 to run a targeted scrape of fee pages for the top 500 `dedicated_ewaste` centers
