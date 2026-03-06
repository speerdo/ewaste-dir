# Google Places Research Script

This script uses the Google Places API to research the 8,115 recycling centers in your database that don't have websites, attempting to find missing website URLs and gather business information similar to what the web scraper collects.

## Purpose

- **Find Missing Websites**: Many businesses have websites that just weren't captured in the original data
- **Gather Business Info**: Extract phone numbers, addresses, business hours, reviews, and ratings
- **Legitimacy Assessment**: Analyze if businesses likely offer electronics recycling services
- **Enrich Database**: Provide comprehensive data for centers currently lacking websites

## Prerequisites

### 1. Google Places API Setup

You need a Google Cloud Platform account and Places API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Places API** and **Maps JavaScript API**
4. Create credentials (API key)
5. Restrict the API key to your IP/domain for security

### 2. Environment Variables

Add to your `.env` file:

```bash
GOOGLE_PLACES_API_KEY=your_api_key_here
```

### 3. API Quotas & Pricing

- **Places Text Search**: $32 per 1,000 requests
- **Place Details**: $17 per 1,000 requests
- **Each center requires 2 API calls** (search + details)
- **Cost for 8,115 centers**: ~$400-500
- **Daily quota**: 1,000 requests/day (increase if needed)

## How It Works

### 1. Data Fetching

```javascript
// Fetches centers without websites using pagination
.or('site.is.null,site.eq.')  // NULL or empty website
```

### 2. Google Places Search

For each center, performs:

1. **Text Search**: `"Business Name City State"`
2. **Place Details**: Gets website, phone, reviews, hours, etc.

### 3. Match Confidence Scoring

- **Name similarity**: Does Places result match original name?
- **Business type**: Electronics store, establishment, etc.
- **Data quality**: Has website, reviews, good rating?
- **Confidence score**: 0-100% match likelihood

### 4. Legitimacy Analysis

Uses the same keyword analysis as web scraper:

- **Recycling keywords**: "electronics recycling", "e-waste", etc.
- **Business types**: Electronics store, repair shop, etc.
- **Review content**: Customer mentions of recycling services

### 5. Description Generation

Prioritizes sources:

1. **Review excerpts** mentioning electronics/recycling
2. **Generated descriptions** based on business type and location

## What Data Is Collected

### Basic Information

- Business name (from Places)
- Phone number
- Full address
- Business hours
- Website URL (if found)
- Google rating & review count

### Analysis Results

- Match confidence score (0-100%)
- Legitimacy score and reasoning
- Suggested business description
- Business type classifications

### Quality Metrics

- **Website discovery rate**: Expected 15-25%
- **Legitimate businesses**: Expected 60-70%
- **High confidence matches**: Expected 80%+

## Usage

### Run the Research Script

```bash
npm run research-places
```

### Output Files

- **Batch Results**: `data/places_research/places_research_TIMESTAMP.json`
- **Progress Tracking**: `data/places_research_progress.json`
- **Summary Report**: `data/places_research/research_summary.json`

### Progress Tracking

The script automatically resumes if interrupted:

```json
{
  "processed": 1250,
  "total": 8115,
  "found_websites": 187,
  "errors": []
}
```

## Sample Results

### Website Found

```json
{
  "centerId": "abc-123",
  "centerName": "ABC Electronics Repair",
  "success": true,
  "website": "https://abcelectronics.com",
  "phone": "(555) 123-4567",
  "rating": 4.5,
  "reviewCount": 127,
  "confidence": 85,
  "legitimacyScore": 75,
  "isLegitimate": true,
  "suggestedDescription": "Electronics repair shop offering device recycling and trade-in services."
}
```

### No Website Found

```json
{
  "centerId": "def-456",
  "centerName": "City Electronics",
  "success": true,
  "website": null,
  "phone": "(555) 987-6543",
  "confidence": 90,
  "legitimacyScore": 45,
  "isLegitimate": true,
  "suggestedDescription": "Electronics store that may offer electronics recycling services."
}
```

## Rate Limiting & Performance

- **Request Delay**: 1 second between API calls
- **Batch Size**: 10 centers per batch
- **Estimated Runtime**: 2.5-3 hours for all 8,115 centers
- **Daily Processing**: Can complete ~2,500 centers/day with standard quotas

## Cost Optimization Tips

1. **Test with small batches first**
2. **Monitor API usage** in Google Cloud Console
3. **Consider increasing quotas** if running frequently
4. **Use results to update database** only after review

## Integration with Web Scraper

Found websites can be:

1. **Added to database** via update script
2. **Fed to web scraper** for content extraction
3. **Combined with existing data** for comprehensive coverage

## Monitoring & Quality Control

### Success Metrics

- Website discovery rate: 15-25%
- High confidence matches: 80%+
- Legitimate business rate: 60-70%

### Quality Checks

- Review confidence scores
- Validate name matches manually
- Check website URLs for accuracy
- Cross-reference with original data

## Next Steps After Research

1. **Review Results**: Check confidence scores and matches
2. **Update Database**: Add discovered websites to `recycling_centers` table
3. **Run Web Scraper**: Process newly found websites for detailed content
4. **Verify Quality**: Spot-check high-value discoveries

This research script bridges the gap between your existing 33k centers with websites and the 8k without, potentially increasing your scrapeable dataset by 15-25%.
