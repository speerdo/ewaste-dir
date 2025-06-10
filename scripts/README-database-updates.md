# Database Update Process

This directory contains scripts to safely update your e-waste recycling center database with new scraped data and remove centers that are no longer legitimate.

## 🎯 Overview

After completing the web scraping process, you now have:

- **14,092 centers** from Google Places research
- **Additional websites** from alternative scraping methods
- **Quality scores** and legitimacy analysis for each center
- **Centers to remove** that failed validation or have suspicious content

The database update process will:

1. **Update existing centers** with new descriptions, websites, and contact information
2. **Remove centers** that failed scraping or scored too low on legitimacy
3. **Add metadata** about scraping quality and business legitimacy

## 🛡️ Safety First: Testing Environment

**⚠️ CRITICAL: Never run these scripts directly against production without testing first!**

### Option 1: Supabase Development Branch (Recommended)

**Cost:** $0.01344/hour (~$0.32/day or $9.68/month)  
**Setup Time:** ~5 minutes  
**Benefits:** Isolated, safe, easy to merge back

```bash
# See setup options
node scripts/setup-database-branch.js

# Create development branch (follow the guided steps)
node scripts/setup-database-branch.js --create-branch
```

### Option 2: Manual Database Clone (Free)

**Cost:** Free  
**Setup Time:** ~30-60 minutes  
**Benefits:** Full control, stays on free plan

```bash
# See manual setup instructions
node scripts/setup-database-branch.js --manual-clone
```

## 📊 Database Update Script Features

### Smart Data Loading

- Loads data from multiple sources (original scraping, retry attempts, final alternative scraping)
- Automatically deduplicates results (prefers most recent and successful attempts)
- Handles different data formats and sources seamlessly

### Legitimacy-Based Processing

- **Updates centers** with legitimacy scores ≥ 25
- **Removes centers** with scores < 25 or marked as suspicious
- **Preserves legitimate businesses** while filtering out non-recycling businesses

### Safe Preview Mode

- **Dry run by default** - shows what would be changed without making changes
- Detailed reports on proposed updates and removals
- Must explicitly use `--live` flag to apply changes

### Comprehensive Updates

- **Descriptions:** Adds quality business descriptions for better SEO
- **Websites:** Updates with newly discovered websites
- **Contact Info:** Improves phone number data
- **Metadata:** Adds legitimacy scores and scraping timestamps

## 🚀 Usage Instructions

### 1. Preview Changes (Safe - No Database Modifications)

```bash
# Preview using production database credentials (read-only)
node scripts/update-database.js --dry-run

# Preview using branch environment
node scripts/update-database.js --branch --dry-run
```

**What this does:**

- Analyzes all scraped data
- Shows exactly what would be updated/removed
- Generates detailed reports
- **Makes NO changes to database**

### 2. Apply Changes to Test Environment

```bash
# Apply to branch environment (after creating branch)
node scripts/update-database.js --branch --live
```

**What this does:**

- Updates centers with new information
- Removes centers marked for deletion
- Adds legitimacy tracking columns
- Generates completion reports

### 3. Apply Changes to Production (After Testing)

```bash
# Only after thorough testing in branch environment
node scripts/update-database.js --live
```

## 📋 Configuration Options

Edit the CONFIG section in `scripts/update-database.js`:

```javascript
const CONFIG = {
  LEGITIMACY_THRESHOLD: 25, // Minimum score to keep a center
  SUSPICIOUS_THRESHOLD: -10, // Below this, definitely remove
  BATCH_SIZE: 50, // Centers processed per batch
  DRY_RUN: false, // Default to dry run mode
};
```

## 📈 Expected Results

Based on your data quality analysis:

### Updates Expected:

- **~2,000-4,000 centers** will receive updates
- **~1,500-3,000** new descriptions added
- **~1,000-2,000** website URLs updated
- **~500-1,000** phone numbers improved

### Removals Expected:

- **~3,000-5,000 centers** will be removed
- **Failed scraping:** Centers where websites were inaccessible
- **Low legitimacy:** Non-recycling businesses (restaurants, casinos, etc.)
- **Suspicious content:** Businesses that don't match e-waste recycling

## 📊 Reports Generated

After running the script, you'll get:

### Summary Reports

- `database_update_summary.json` - Complete statistics and timing
- `database_update_preview.json` - Dry run preview results

### Detailed Lists

- `centers_to_remove.json` - Full list of centers marked for removal
- `centers_to_remove.csv` - Same data in CSV format for easy review

### Quality Metrics

- Processing time and batch statistics
- Success/failure rates
- Legitimacy score distributions
- Error logs for troubleshooting

## 🔧 Troubleshooting

### Missing Credentials Error

```bash
❌ Missing Supabase BRANCH credentials
```

**Solution:** Create `.env.branch` file with branch credentials or add branch variables to your main `.env` file.

### Column Addition Errors

Some legitimacy tracking columns may need manual addition if automatic creation fails:

```sql
ALTER TABLE recycling_centers
ADD COLUMN IF NOT EXISTS legitimacy_score INTEGER,
ADD COLUMN IF NOT EXISTS legitimacy_reason TEXT,
ADD COLUMN IF NOT EXISTS is_legitimate BOOLEAN,
ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN,
ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;
```

### Large Dataset Performance

For optimal performance with large datasets:

- Use smaller `BATCH_SIZE` (25-50) to avoid timeouts
- Run during off-peak hours
- Monitor database performance during execution

## 🎯 Recommended Workflow

### Phase 1: Analysis & Planning

```bash
# 1. Review setup options
node scripts/setup-database-branch.js

# 2. Preview changes without any database access
node scripts/update-database.js --dry-run
```

### Phase 2: Safe Testing

```bash
# 3. Create development branch (if using Option 1)
# Follow the guided setup process

# 4. Test updates in branch environment
node scripts/update-database.js --branch --dry-run
node scripts/update-database.js --branch --live

# 5. Review results and reports
```

### Phase 3: Production Deployment

```bash
# 6. Apply to production (only after successful testing)
node scripts/update-database.js --live

# 7. Monitor and verify results
```

## 🔄 Post-Update Steps

After successful database updates:

1. **Verify Results:**

   - Check updated center descriptions on your website
   - Verify removed centers are no longer showing
   - Test search functionality with new data

2. **Clean Up:**

   - Delete development branch (if used) to stop charges
   - Archive scraping data files
   - Update any application caches

3. **Monitor:**
   - Watch for user feedback on data quality
   - Monitor site performance with updated dataset
   - Track search and conversion metrics

## 📞 Support

If you encounter issues:

1. Check the generated error logs in `database_update_summary.json`
2. Review the legitimacy reports for removed centers
3. Use dry run mode to debug without making changes
4. Verify database connectivity and credentials

## 🎉 Success Metrics

A successful update should achieve:

- **95%+ processing success rate**
- **Significant description improvement** (1,500+ centers with new descriptions)
- **Quality website additions** (1,000+ new/updated URLs)
- **Clean dataset** (removal of non-recycling businesses)
- **Zero critical errors** in processing

---

**Ready to proceed?** Start with the setup script:

```bash
node scripts/setup-database-branch.js
```
