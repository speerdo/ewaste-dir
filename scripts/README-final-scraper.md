# Final Alternative Source Scraper

This script performs a final targeted scraping pass on the highest-priority centers from our manual review list, using alternative sources like Yelp, Yellow Pages, and business directories to find websites that may have been missed in previous scraping attempts.

## Overview

The final scraper is designed to:

- Load prioritized centers from the strategy analysis
- Search multiple alternative sources (Yelp, Yellow Pages, Google Business Search)
- Apply the same business legitimacy analysis as our main scrapers
- Generate comprehensive reports with found websites and quality scores

## Prerequisites

1. **Completed Strategy Analysis**: Run `node scripts/final-scraping-strategy.js` first to generate target files
2. **Required Dependencies**: Ensure you have puppeteer and csv-parser installed

```bash
npm install puppeteer csv-parser
```

## Usage

### Basic Usage (Phase 1 only - High Priority)

```bash
node scripts/final-alternative-scraper.js
```

### Run Specific Phases

```bash
# Run only Phase 1 (300 highest priority centers)
node scripts/final-alternative-scraper.js phase1

# Run Phase 1 and Phase 2
node scripts/final-alternative-scraper.js phase1 phase2

# Run all phases
node scripts/final-alternative-scraper.js phase1 phase2 phase3
```

## How It Works

### 1. Data Loading

- Loads target centers from CSV files in `data/final_scraping/`
- Each phase has different priority thresholds:
  - **Phase 1**: 300 centers (Priority Score ≥ 15, Legitimacy ≥ 20)
  - **Phase 2**: 400 centers (Priority Score ≥ 10, Legitimacy ≥ 10)
  - **Phase 3**: 300 centers (Priority Score ≥ 5, Legitimacy ≥ 0)

### 2. Alternative Source Searching

For each center, the script searches:

- **Yelp**: Business directory search
- **Yellow Pages**: Local business listings
- **Google Business Search**: General business search

### 3. Link Filtering & Scoring

- Filters found links by relevance to business name and location
- Prioritizes exact name matches and electronics-related keywords
- Scores and ranks potential websites

### 4. Website Content Analysis

- Scrapes the best website found for each center
- Applies the same legitimacy analysis as existing scripts:
  - **Recycling Keywords**: e-waste, electronics recycling, etc.
  - **Red Flag Keywords**: restaurant, casino, medical, etc.
  - **Legitimacy Scoring**: Weighted scoring system (25+ = legitimate)

## Output Files

All output files are saved to `data/final_scraping_results/`:

### Progress Tracking

- `final_scraping_progress.json` - Current progress and resumable state

### Results Files

- `final_scraping_results_[phase]_[timestamp].json` - Detailed results
- `final_scraping_summary_[phase]_[timestamp].csv` - Summary CSV for analysis
- `final_report_[phase]_[timestamp].json` - Comprehensive report

### CSV Summary Format

```
Center ID,Name,City,State,Website Found,Total URLs Found,Legitimacy Score,Is Legitimate,Is Suspicious,Legitimacy Reason,Phone
```

## Configuration

Key settings in the script (adjust if needed):

```javascript
const CONFIG = {
  BATCH_SIZE: 5, // Centers per batch
  DELAY_BETWEEN_REQUESTS: 3000, // 3 seconds between requests
  TIMEOUT: 25000, // 25 second page timeout
  MAX_RETRIES: 2, // Retry failed requests
  DELAY_BETWEEN_RETRIES: 5000, // 5 seconds between retries
};
```

## Business Legitimacy Analysis

The script uses the same analysis logic as your existing scrapers:

### High-Value Keywords (5x weight)

- e-waste, electronics recycling, r2 certified, data destruction

### Medium-Value Keywords (2x weight)

- recycle, recycling, electronics, computers, waste management

### Standard Keywords (1x weight)

- All other electronics and recycling-related terms

### Red Flag Keywords (penalty)

- restaurant, casino, medical, real estate, etc.

### Legitimacy Thresholds

- **≥ 25**: Legitimate e-waste recycler
- **< -10**: Suspicious (likely not electronics-related)
- **-10 to 24**: Uncertain (may need manual review)

## Progress & Resume Capability

The script automatically saves progress and can resume if interrupted:

- Progress saved every 5 centers
- Resume with same command that was interrupted
- Progress file: `data/final_scraping_progress.json`

## Expected Results

Based on the strategy analysis:

- **Phase 1**: ~60-80% success rate (highest quality centers)
- **Phase 2**: ~40-60% success rate
- **Phase 3**: ~20-40% success rate

## Monitoring

The script provides detailed console output:

```
🔍 [45/300] Searching for: PayMore Electronics
   📍 Location: Atlanta, GA
   📊 Priority Score: 30.0, Legitimacy: 115
  🔍 Searching yelp...
    📊 Found 3 potential business URLs
   ✅ Found 2 potential websites
   🎯 Best website: https://paymorelectronics.com
   ✅ Legitimate (score: 95)
```

## Recommendations

1. **Start with Phase 1** - highest success rate and best ROI
2. **Monitor results** - check CSV outputs after each phase
3. **Adjust delays** if you encounter rate limiting
4. **Review legitimacy scores** - focus on scores ≥ 50 for highest confidence

## Next Steps After Completion

1. **Review CSV summaries** for newly found websites
2. **Update your database** with legitimate findings
3. **Manual review** any uncertain cases (legitimacy 0-24)
4. **Remove suspicious centers** (legitimacy < -10) from database
