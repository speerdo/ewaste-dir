# City Sync Strategy
## Keeping `cities` Table in Sync with `recycling_centers`

**Created:** November 3, 2025  
**Status:** Planning Document  
**Purpose:** Ensure the `cities` table remains the source of truth for city-level data while staying synchronized with the `recycling_centers` table

---

## 🎯 Problem Statement

The `recycling_centers` table is the primary data source containing all recycling center listings. The `cities` table serves as a secondary aggregation layer that stores:
- Unique city/state combinations
- AI-generated descriptions for SEO
- Aggregated statistics (center count, population)
- City-specific metadata

**Key Challenges:**
1. **New Cities:** When recycling centers are added to a new city, we need to create a city record with a generated description
2. **Removed Cities:** When all recycling centers are removed from a city, we need to decide whether to keep or remove the city record
3. **Updated Counts:** When centers are added/removed, the `recycling_center_count` needs updating
4. **Description Generation Cost:** AI description generation costs ~$0.0003 per city
5. **Data Consistency:** Prevent orphaned cities or missing cities

---

## 🏗️ Architecture Options

### Option 1: Database Triggers (Real-Time Sync)

**How it works:**
- Postgres triggers on `recycling_centers` table (INSERT, UPDATE, DELETE)
- Automatically update `cities` table when centers change
- Queue description generation for new cities

**Pros:**
- ✅ Real-time synchronization
- ✅ No manual intervention needed
- ✅ Data always consistent
- ✅ Works with any data modification (UI, API, bulk imports)

**Cons:**
- ❌ Complex trigger logic
- ❌ Need queue system for async AI generation
- ❌ Harder to debug and maintain
- ❌ Could impact performance on bulk operations
- ❌ Supabase Edge Functions needed for AI calls

**Best for:** Production systems with frequent data changes

---

### Option 2: Scheduled Sync Jobs (Periodic Batch)

**How it works:**
- Run a sync script on a schedule (daily, weekly, after imports)
- Detect differences between tables
- Add new cities, update counts, optionally remove orphans
- Generate descriptions in batch

**Pros:**
- ✅ Simple to implement and understand
- ✅ Full control over sync timing
- ✅ Can batch AI generation for cost efficiency
- ✅ Easy to test and debug
- ✅ Can run manually when needed

**Cons:**
- ❌ Not real-time (lag between changes)
- ❌ Need to remember to run after bulk imports
- ❌ Could miss rapid changes between runs

**Best for:** Data that changes infrequently or in batches (like bulk imports from scraping)

---

### Option 3: Event-Driven Sync (Hybrid Approach)

**How it works:**
- Emit events when recycling centers are added/removed via API
- Sync service listens to events and updates cities table
- Manual sync script available for bulk operations
- Description generation queued via background jobs

**Pros:**
- ✅ Fast for API operations
- ✅ Efficient for bulk operations (manual sync)
- ✅ Clear separation of concerns
- ✅ Scalable architecture

**Cons:**
- ❌ More complex infrastructure
- ❌ Need event system (Redis, RabbitMQ, etc.)
- ❌ Two different code paths to maintain

**Best for:** High-traffic production systems with both API and bulk operations

---

### Option 4: Manual Sync on Demand

**How it works:**
- Run sync script manually after data changes
- Admin dashboard button to trigger sync
- Pre-deployment sync as part of data pipeline

**Pros:**
- ✅ Simplest implementation
- ✅ Full control and visibility
- ✅ No background infrastructure needed
- ✅ Perfect for development/staging

**Cons:**
- ❌ Human error risk (forgetting to run)
- ❌ Not suitable for production with frequent changes
- ❌ Poor user experience if data lags

**Best for:** Low-traffic sites, development environments, or pre-launch phase

---

## 🎖️ Recommended Approach

**For Current State (Pre-Launch / Low Traffic):**
**Option 2: Scheduled Sync Jobs** + Manual Trigger Capability

**Rationale:**
1. Your data changes primarily through bulk scraping/imports (not real-time user input)
2. AI generation cost makes batching preferable
3. Simpler to implement and debug
4. Can upgrade to triggers/events later if needed

**For Future State (High Traffic / Production):**
**Option 3: Event-Driven Sync** (Hybrid)
- Upgrade when you have more dynamic data updates
- When you add user-generated content
- When API traffic increases significantly

---

## 🔧 Detailed Implementation Plan

### Phase 1: Core Sync Script

**Purpose:** Detect and sync differences between tables

**What it does:**
1. **Detect New Cities**
   - Get unique city/state pairs from `recycling_centers`
   - Compare with `cities` table
   - Identify missing cities

2. **Detect Orphaned Cities**
   - Find cities with zero recycling centers
   - Decision: Keep with flag or remove?

3. **Update City Counts**
   - Recalculate `recycling_center_count` for all cities
   - Update `cities` table

4. **Generate City IDs**
   - Create slugs from city names consistently
   - Handle duplicates (e.g., "Springfield" in multiple states)

**Output:**
- List of new cities needing descriptions
- List of orphaned cities
- Count of updated cities
- Detailed log for auditing

---

### Phase 2: Description Generation

**Purpose:** Generate AI descriptions for new cities

**What it does:**
1. Read list of new cities from Phase 1
2. Get context (center count, state, population if available)
3. Call OpenAI API with uniqueness prompts
4. Validate generated content
5. Save to `cities` table with metadata:
   - `description`
   - `description_verified: false`
   - `description_generated_at`
   - `description_source: 'openai'`

**Features:**
- Rate limiting (60/min for OpenAI)
- Checkpointing (resume if interrupted)
- Incremental saving (every 10 cities)
- Cost tracking and reporting
- Retry logic for failures

**Cost Management:**
- Estimate cost before running
- Allow dry-run mode
- Set max cities per run
- Track cumulative costs

---

### Phase 3: Orphaned City Handling

**Purpose:** Decide what to do with cities that lose all centers

**Strategy Options:**

**Option A: Soft Delete (Recommended)**
- Add `is_active` boolean to cities table
- Set `is_active = false` for orphaned cities
- Keep historical data and descriptions
- Can reactivate if centers return
- Don't show in site navigation
- Keep for SEO if already indexed

**Option B: Hard Delete**
- Remove city from database
- Lose AI-generated content
- Need to regenerate if city returns
- Simpler database

**Option C: Archive Table**
- Move orphaned cities to `archived_cities` table
- Keep data but separate from active records
- Can restore if needed

**Recommended:** **Option A (Soft Delete)** because:
- Preserves investment in AI-generated content
- Better for SEO (already indexed pages)
- Cities might get centers again
- Safer than permanent deletion

---

### Phase 4: Scheduling & Automation

**When to Run Sync:**

1. **After Bulk Data Imports** (Manual Trigger)
   - After scraping new recycling centers
   - After importing CSV data
   - Part of data pipeline

2. **Daily Scheduled Job** (Automated)
   - Runs overnight (low traffic)
   - Catches any missed changes
   - Updates counts
   - Generates descriptions for new cities

3. **Pre-Deployment** (CI/CD Hook)
   - Ensure sync before deploying
   - Part of build process
   - Prevents stale data in production

**Implementation Options:**
- **Cron job** (simple, traditional)
- **GitHub Actions** (integrated with repo)
- **Vercel Cron** (serverless, free tier)
- **Supabase pg_cron** (database-level)

---

## 📋 Sync Script Features

### Core Features
- ✅ Detect new cities from recycling_centers
- ✅ Generate unique city IDs (slugs)
- ✅ Update recycling_center_count for existing cities
- ✅ Identify orphaned cities (zero centers)
- ✅ Generate AI descriptions for new cities
- ✅ Save incrementally (no data loss)
- ✅ Detailed logging and reporting

### Advanced Features
- ✅ Dry-run mode (preview changes without applying)
- ✅ Cost estimation before AI generation
- ✅ Resume capability (checkpointing)
- ✅ Rate limiting for API calls
- ✅ Validation of generated content
- ✅ Rollback capability for mistakes
- ✅ Diff report (what changed)
- ✅ Email/notification on completion
- ✅ Metrics tracking (how many added, updated, removed)

### Safety Features
- ✅ Confirmation prompts for destructive operations
- ✅ Backup before sync
- ✅ Rollback script in case of errors
- ✅ Max changes threshold (abort if too many changes detected)
- ✅ Database transaction support (all-or-nothing)

---

## 🔄 Sync Workflow Example

```
1. Pre-Sync Phase
   └─ Backup current cities table
   └─ Run in dry-run mode first
   └─ Review proposed changes
   └─ Estimate AI generation cost

2. Detection Phase
   └─ Query recycling_centers for unique city/state pairs
   └─ Compare with cities table
   └─ Identify: New (N), Updated (U), Orphaned (O)
   └─ Generate report:
      • 15 new cities detected
      • 142 cities need count updates
      • 3 orphaned cities found
      • Estimated cost: $0.0045 for new descriptions

3. Confirmation Phase
   └─ Display summary
   └─ Ask: "Proceed with sync? (y/n)"
   └─ If yes, continue
   └─ If no, exit with no changes

4. Update Phase
   └─ Update recycling_center_count for all existing cities
   └─ Mark orphaned cities as inactive (is_active = false)
   └─ Create city records for new cities (without descriptions yet)
   └─ Save checkpoint

5. Description Generation Phase
   └─ For each new city:
      ├─ Generate AI description
      ├─ Validate content
      ├─ Save to database
      ├─ Update checkpoint
      └─ Save every 10 cities
   └─ Handle errors gracefully

6. Verification Phase
   └─ Count total cities: should match unique recycling_centers cities
   └─ Verify all active cities have descriptions
   └─ Check all orphaned cities marked correctly
   └─ Generate final report

7. Post-Sync Phase
   └─ Log metrics to database or file
   └─ Send notification/email if configured
   └─ Clean up checkpoint files
   └─ Mark sync completion timestamp
```

---

## 🚨 Edge Cases to Handle

### 1. City Name Variations
**Problem:** "St. Louis" vs "Saint Louis" vs "St Louis"
**Solution:** 
- Normalize city names before comparison
- Store both normalized and display names
- Create mapping table for common variations

### 2. Duplicate City Names
**Problem:** Springfield exists in multiple states
**Solution:**
- City ID must include state: `springfield-illinois`
- Always compare city + state together
- Unique constraint on (name, state_id)

### 3. City Name Changes
**Problem:** City renames or merges
**Solution:**
- Manual intervention required
- Alias table for redirects
- Keep old descriptions with historical flag

### 4. Bulk Import Failures
**Problem:** Sync detects 500+ new cities (seems wrong)
**Solution:**
- Set threshold: abort if > 100 new cities detected
- Require admin confirmation for large changes
- Flag for manual review

### 5. AI Generation Failures
**Problem:** OpenAI API fails mid-generation
**Solution:**
- Checkpoint after each successful generation
- Resume from checkpoint on restart
- Save partial results incrementally
- Retry failed cities at end

### 6. Description Quality Issues
**Problem:** Generated description mentions wrong city
**Solution:**
- Validation step checks city name in description
- Reject and retry with stricter prompt
- Flag for manual review if fails twice
- Allow manual description override

### 7. Race Conditions
**Problem:** Two sync scripts run simultaneously
**Solution:**
- Lock file or database lock
- Check lock before starting
- Clear lock on completion or timeout
- Log warning if lock detected

---

## 💰 Cost Considerations

### AI Description Generation Costs
- **Per city:** ~$0.0003 (GPT-4o-mini)
- **1,000 new cities:** ~$0.30
- **10,000 new cities:** ~$3.00

### Cost Optimization Strategies:
1. **Batch Generation**
   - Generate in bulk rather than one-by-one
   - Better rate limit utilization

2. **Caching**
   - Never regenerate existing descriptions
   - Store generation timestamp

3. **Selective Generation**
   - Only generate for cities with multiple centers
   - Defer single-center cities

4. **Template Fallback**
   - Use templates for very small cities (<2 centers)
   - AI for cities with 3+ centers
   - Saves ~$0.0003 per small city

5. **Smart Scheduling**
   - Generate during low-traffic hours
   - Spread cost over time
   - Set daily budget limits

---

## 📊 Monitoring & Metrics

### Key Metrics to Track:
- Total cities in database
- Active vs inactive cities
- Cities with descriptions vs without
- Average centers per city
- Sync frequency and duration
- AI generation success rate
- AI generation cost per sync
- Orphaned cities count
- Description quality scores

### Alerts to Configure:
- 🚨 Sync fails to complete
- 🚨 Large number of orphaned cities (>50)
- 🚨 AI generation error rate >5%
- 🚨 Cities without descriptions >10
- 💰 Daily AI cost exceeds $5
- ⏰ Sync takes >2 hours

---

## 🎯 Implementation Checklist

### Scripts to Create:
- [ ] `sync-cities-full.js` - Main sync orchestrator
- [ ] `detect-city-changes.js` - Compare tables, report differences
- [ ] `update-city-counts.js` - Recalculate center counts
- [ ] `generate-new-city-descriptions.js` - AI generation for new cities
- [ ] `handle-orphaned-cities.js` - Mark inactive or remove
- [ ] `validate-city-sync.js` - Verify data consistency
- [ ] `rollback-sync.js` - Undo last sync if needed

### npm Scripts to Add:
```json
{
  "sync-cities": "node scripts/sync-cities-full.js",
  "sync-cities:dry-run": "node scripts/sync-cities-full.js --dry-run",
  "sync-cities:detect": "node scripts/detect-city-changes.js",
  "sync-cities:counts": "node scripts/update-city-counts.js",
  "sync-cities:validate": "node scripts/validate-city-sync.js",
  "sync-cities:rollback": "node scripts/rollback-sync.js"
}
```

### Database Changes:
- [ ] Add `is_active` boolean to cities (default true)
- [ ] Add `last_synced_at` timestamp to cities
- [ ] Add `sync_history` table to track all syncs
- [ ] Add `city_name_aliases` table for variations
- [ ] Add indexes for performance

### Documentation:
- [ ] README for sync process
- [ ] Runbook for common issues
- [ ] Decision log for edge cases
- [ ] Cost tracking spreadsheet

---

## 🚀 Migration Path

### Current State → Phase 1
1. Run existing `sync-cities-table.js` to baseline
2. Ensure all cities have descriptions
3. Validate current state

### Phase 1: Core Sync
1. Create detection script
2. Create count update script
3. Test on staging database
4. Run manually after imports

### Phase 2: Automation
1. Schedule daily cron job
2. Add monitoring and alerts
3. Create dashboard for metrics

### Phase 3: Polish
1. Add dry-run mode
2. Add rollback capability
3. Improve error handling
4. Add cost tracking

### Phase 4: Advanced Features
1. Event-driven sync (if needed)
2. Real-time triggers (if needed)
3. Multi-region support
4. API for external integrations

---

## 🤔 Open Questions

1. **Orphaned Cities:** Should we keep cities with zero centers for SEO, or remove them?
   - **Recommendation:** Keep with `is_active = false` flag

2. **Description Updates:** Should we regenerate descriptions when center count changes significantly?
   - **Recommendation:** Only regenerate if count changes by >50% or drops to 0

3. **Manual Overrides:** How to handle manually edited descriptions?
   - **Recommendation:** Add `description_manual_override` flag to prevent AI overwriting

4. **Historical Data:** Should we track history of changes?
   - **Recommendation:** Yes, create `sync_history` table with before/after snapshots

5. **Performance:** What if we have 10,000+ cities?
   - **Recommendation:** Batch processing, pagination, and async queue for descriptions

---

## 📚 Related Documents

- `CITY-CONTENT-ENHANCEMENT-ACTION-PLAN.md` - Original city description strategy
- `README-city-descriptions.md` - Technical documentation for description scripts
- `QUICK-START-CITY-DESCRIPTIONS.md` - Quick start guide

---

## ✅ Next Steps

1. **Review this document** and discuss trade-offs
2. **Decide on Option 2 (Scheduled) vs Option 3 (Event-Driven)**
3. **Prioritize features** (core vs nice-to-have)
4. **Create implementation tickets**
5. **Start with Phase 1** (detection and count updates)
6. **Test on staging** before production rollout

---

**Decision needed:** Which approach do you want to implement first?
- **Simple:** Option 2 (Scheduled Sync) - Can be done in 1-2 days
- **Robust:** Option 3 (Event-Driven) - Takes 3-5 days but more scalable

