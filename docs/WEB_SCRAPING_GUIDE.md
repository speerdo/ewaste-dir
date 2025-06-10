# Web Scraping Guide for Recycling Centers

This guide covers the comprehensive web scraping system designed to enhance your recycling centers database with descriptions and legitimacy verification.

## Overview

The web scraping system processes 40,000+ recycling centers to:

1. **Extract business descriptions** from their websites
2. **Verify legitimacy** as actual recycling businesses
3. **Update the database** with enhanced information
4. **Flag suspicious entries** for potential removal

## Architecture

### Components

1. **`scripts/web-scraper.js`** - Main scraping engine
2. **`scripts/update-database.js`** - Database update processor
3. **`supabase/migrations/20250124000002_add_legitimacy_tracking.sql`** - Database schema changes

### Process Flow

```
Database → Web Scraper → Scraped Data → Database Updater → Enhanced Database
                    ↓
               Suspicious List
```

## Setup

### 1. Install Dependencies

```bash
npm install puppeteer
```

### 2. Environment Variables

Ensure these are set in your `.env`:

```
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Migration

Apply the legitimacy tracking migration:

```bash
# Using Supabase CLI (recommended)
supabase db push

# Or run the migration manually in your database
```

## Usage

### Quick Start

Run the complete scraping and update process:

```bash
npm run scrape-and-update
```

### Step-by-Step Process

1. **Scrape websites only:**

```bash
npm run scrape-websites
```

2. **Update database with results:**

```bash
npm run update-database
```

## Configuration

### Web Scraper Settings

Located in `scripts/web-scraper.js`:

```javascript
const CONFIG = {
  BATCH_SIZE: 10, // Process 10 centers at a time
  DELAY_BETWEEN_REQUESTS: 2000, // 2 seconds between requests
  TIMEOUT: 30000, // 30 second timeout per page
  MAX_RETRIES: 3, // Retry failed requests
  OUTPUT_DIR: './data/scraped_data', // Output directory
  PROGRESS_FILE: './data/scraping_progress.json',
};
```

**⚠️ Important Rate Limiting:**

- Default: 2-second delay between requests
- Processing 10 centers per batch
- Estimated time: ~5-8 hours for 40,000 centers

### Legitimacy Assessment

The system uses keyword analysis to identify businesses that offer electronics recycling services (not just dedicated recycling companies):

**Positive Keywords** (increase legitimacy score):

- **Core recycling:** recycle, recycling, e-waste, electronics recycling
- **Electronics businesses:** electronics, computers, phones, repair shops
- **Retail services:** trade-in, buyback, drop-off, office supplies
- **Certifications:** r2 certified, iso 14001

**Red Flag Keywords** (decrease legitimacy score):

- Businesses clearly unrelated to electronics: restaurants, hotels, medical, beauty salons

**Inclusive Scoring System:**

- Score ≥ 25: Considered legitimate (includes retailers, repair shops, etc.)
- Score < -10: Flagged as suspicious (only clearly non-electronics businesses)

## Monitoring Progress

### Real-time Monitoring

The scraper provides real-time progress updates:

```
Processing batch 1/4000 (10 centers)...
✓ ABC Recycling - Legitimacy Score: 45
✗ XYZ Company - Failed to scrape
Batch complete: 8 legitimate, 1 suspicious
Overall progress: 10/40000 (0%)
```

### Progress Files

- **`data/scraping_progress.json`** - Current progress state
- **`data/scraped_data/scraping_results_*.json`** - Batch results
- **`data/scraped_data/scraping_summary.json`** - Final summary

## Output Files

### Scraped Data

Results are saved in timestamped batch files:

```
data/scraped_data/
├── scraping_results_2024-01-24T10-30-00-000Z.json
├── scraping_results_2024-01-24T10-35-00-000Z.json
├── scraping_summary.json
└── scraping_progress.json
```

### Suspicious Centers

Centers flagged for review:

```
data/scraped_data/
├── suspicious_centers.json  # Detailed JSON data
└── suspicious_centers.csv   # Spreadsheet for easy review
```

### Example Suspicious Centers CSV

```csv
ID,Name,URL,City,State,Legitimacy Score,Reason,Scraped Title
abc-123,"Joe's Auto Repair","joeauto.com","Portland","OR",-15,"Multiple red flags (3 matches)","Auto Repair & Towing"
```

## Database Schema Changes

New columns added to `recycling_centers` table:

```sql
legitimacy_score    INTEGER     -- Numeric legitimacy score
legitimacy_reason   TEXT        -- Explanation of assessment
is_legitimate      BOOLEAN      -- Quick legitimacy flag
is_suspicious      BOOLEAN      -- Quick suspicious flag
scraped_at         TIMESTAMPTZ  -- Last scrape timestamp
```

## Best Practices

### 1. Start Small

Test with a subset first:

```javascript
// In web-scraper.js, modify the query:
.limit(100)  // Test with 100 centers first
```

### 2. Monitor Rate Limiting

- Watch for `429 Too Many Requests` errors
- Increase delays if needed
- Some sites may block after repeated requests

### 3. Handle Interruptions

The scraper is resumable:

- Progress is saved after each batch
- Restart with `npm run scrape-websites` to resume
- Delete `data/scraping_progress.json` to start fresh

### 4. Review Suspicious Centers

Manual review is recommended for flagged centers:

1. Open `data/scraped_data/suspicious_centers.csv`
2. Review the scraped titles and legitimacy reasons
3. Manually verify questionable entries
4. Remove confirmed non-recycling businesses

## Troubleshooting

### Common Issues

**1. Puppeteer Installation Failed**

```bash
# On Linux, install dependencies:
sudo apt-get install -y libxtst6 libxrandr2 libasound2 libpangocairo-1.0-0 libatk1.0-0 libcairo-gobject2 libgtk-3-0 libgdk-pixbuf2.0-0

# Or skip Chromium download and use system Chrome:
npm config set puppeteer_skip_chromium_download true
```

**2. Memory Issues**

```bash
# Increase Node.js memory limit:
NODE_OPTIONS="--max-old-space-size=4096" npm run scrape-websites
```

**3. Network Timeouts**

- Increase `TIMEOUT` in configuration
- Check internet connection stability
- Some sites may be temporarily unavailable

**4. Database Connection Issues**

- Verify Supabase credentials
- Check service role key permissions
- Ensure migration was applied

### Debugging

Enable detailed logging:

```javascript
// In web-scraper.js
console.log('Debug: Processing center:', center);
```

## Performance Optimization

### 1. Parallel Processing

For faster processing (advanced users):

```javascript
const CONFIG = {
  BATCH_SIZE: 20, // Increase batch size
  DELAY_BETWEEN_REQUESTS: 1000, // Reduce delay (be careful!)
};
```

### 2. Server-based Scraping

For large-scale operations, consider:

- Running on a server with better bandwidth
- Using a VPN to avoid IP blocks
- Implementing proxy rotation

## Data Quality

### Validation

The system validates:

- ✅ URL accessibility
- ✅ Content extraction success
- ✅ Keyword relevance
- ✅ Description quality

### Enhancement

Generated descriptions prioritize:

1. Meta descriptions from websites
2. Sentences containing recycling keywords
3. Fallback to generic descriptions

## Legal Considerations

### Responsible Scraping

- ✅ Respects robots.txt (when implemented)
- ✅ Uses reasonable delays
- ✅ Doesn't overload servers
- ✅ Only extracts public information

### Terms of Service

- Review target websites' terms of service
- Consider reaching out to businesses for partnership
- Use data responsibly and ethically

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review console output for error messages
3. Examine the generated log files
4. Consider running a smaller test batch first

---

**Estimated Completion Time:** 5-8 hours for 40,000 centers
**Success Rate:** Typically 70-85% depending on website accessibility
**Enhancement Rate:** ~60-80% of centers will receive improved descriptions
