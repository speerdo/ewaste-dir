# Quick Start: Generate City Descriptions

**Goal:** Create unique, AI-generated descriptions for all ~3,970 city pages to improve Google AdSense approval chances.

**Time Required:** 3-5 days (mostly automated)  
**Cost:** $0 (using free Google Gemini API)

---

## Prerequisites (5 minutes)

1. **Install packages:**
   ```bash
   npm install
   ```

2. **Get Gemini API key:**
   - Visit: https://makersuite.google.com/app/apikey
   - Sign in with Google (Pixel 10 Pro account)
   - Click "Create API Key"
   - Copy the key

3. **Add to `.env`:**
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run database migration:**
   ```bash
   # Run this SQL in Supabase dashboard:
   # supabase/migrations/20251102000000_enhance_cities_table_for_descriptions.sql
   ```

---

## Workflow (4 Simple Steps)

### Step 1: Sync Cities (2 minutes)
```bash
npm run sync-cities
```
✅ Populates cities table with data from recycling_centers

### Step 2: Generate Descriptions (3 days, automated)

**Day 1:**
```bash
npm run generate-descriptions
```
Generates 1,500 descriptions (hits free daily limit)

**Day 2:**
```bash
npm run generate-descriptions
```
Continues from checkpoint, generates another 1,500

**Day 3:**
```bash
npm run generate-descriptions
```
Completes remaining ~970 cities

💡 **Tip:** The script auto-saves progress. It will resume where it left off each day.

### Step 3: Verify Quality (5 minutes)
```bash
npm run verify-descriptions
```
- Runs automated quality checks
- Flags any issues
- Creates sample for manual review

✅ Target: >95% pass rate

### Step 4: Import to Database (5 minutes)

**Test first:**
```bash
npm run import-descriptions -- --dry-run
```

**Then import for real:**
```bash
npm run import-descriptions
```
✅ Auto-creates backup before importing

---

## What You Get

Each city will have a unique **3-paragraph description** (~200 words):

**Paragraph 1:** Overview
- Number of recycling centers
- Types of electronics accepted
- Population context

**Paragraph 2:** Regulations & Environmental Impact
- State e-waste laws
- Environmental benefits
- CO2 savings, material recovery

**Paragraph 3:** Community Benefits
- Economic impact
- Job creation
- How residents can participate

---

## Example Output

**Austin, Texas:**

> Austin residents have access to 23 certified electronics recycling centers throughout the city, providing convenient options for disposing of computers, smartphones, televisions, monitors, batteries, and cables. With a population of nearly one million, Austin has embraced environmental responsibility by making e-waste recycling accessible across diverse neighborhoods...

*(Full 214-word description with unique content)*

---

## Monitoring Progress

**Check database stats anytime:**
```sql
SELECT * FROM get_cities_description_stats();
```

**Files created:**
- `data/generated-city-descriptions.json` - All generated
- `data/verified-city-descriptions.json` - Quality-approved
- `data/backups/cities-backup-*.json` - Database backup

---

## Quick Commands Reference

```bash
# Complete workflow (Steps 1-3)
npm run descriptions-workflow

# Individual steps
npm run sync-cities              # Step 1
npm run generate-descriptions    # Step 2
npm run verify-descriptions      # Step 3
npm run import-descriptions      # Step 4

# Testing (50 cities only)
npm run generate-descriptions -- --limit=50

# Use OpenAI instead (costs ~$2.40)
npm run generate-descriptions -- --api=openai

# Rollback if needed
npm run import-descriptions -- --rollback --file=data/backups/cities-backup-*.json
```

---

## Expected Timeline

| Day | Task | Time | Output |
|-----|------|------|--------|
| **Day 1** | Setup + Sync + Generate | 1 hour | 1,500 descriptions |
| **Day 2** | Generate (resume) | 2 min | 1,500 descriptions |
| **Day 3** | Generate + Verify + Import | 30 min | 970 descriptions + imported |
| **Day 4** | Test + Deploy | 2 hours | Live on website |

**Total active time:** ~3.5 hours  
**Total elapsed time:** 4 days

---

## Success Criteria

- [ ] All 3,970 cities have descriptions
- [ ] >95% pass automated quality checks
- [ ] No duplicate content
- [ ] Descriptions display correctly on city pages
- [ ] Meta tags updated properly
- [ ] Build time remains acceptable (<10 min)
- [ ] Google AdSense approval 🎯

---

## Need Help?

- **Full documentation:** `scripts/README-city-descriptions.md`
- **Action plan:** `docs/CITY-CONTENT-ENHANCEMENT-ACTION-PLAN.md`
- **Script issues:** Check console output and error logs

---

## Why This Matters for AdSense

**Current issue:** City pages use template-based content  
**Solution:** Unique, factual, helpful content for each city  
**Result:** 
- ✅ Original content (not duplicated)
- ✅ Value to users (specific information)
- ✅ Professional quality (AI + human verification)
- ✅ SEO benefits (unique meta descriptions)

**This addresses Google's "Low value content" rejection reason.**

---

## Next Steps After Completion

1. ✅ Test 10-20 city pages manually
2. ✅ Verify SEO meta tags
3. ✅ Check mobile layout
4. ✅ Monitor build performance
5. ✅ Deploy to production
6. ✅ Reapply for Google AdSense

---

**Ready to start?**

```bash
npm install
npm run sync-cities
npm run generate-descriptions
```

Then let it run! ☕

---

**Created:** November 2, 2025  
**Version:** 1.0

