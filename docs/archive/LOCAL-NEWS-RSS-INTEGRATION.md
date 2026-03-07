# Local News RSS Integration

## Overview

This system automatically fetches location-based recycling news from RSS feeds and displays it on city pages. It uses **Google News RSS feeds** (free, no API key required) and optionally **NewsAPI** (requires API key) to gather recent news articles about electronics recycling in specific cities.

## How It Works

1. **RSS Feed Fetching**: The script queries Google News RSS feeds with location-specific search terms
2. **News Storage**: Articles are stored in the `local_regulations.local_news` JSONB field in the database
3. **Display**: The `LocalNews.astro` component displays recent articles (within last 6 months) on city pages

## Setup

### 1. Run Database Migration

First, add the `local_news` field to your database:

```bash
# Apply the migration
# The migration file is: supabase/migrations/20250125000000_add_local_news_field.sql
```

Or manually run:

```sql
ALTER TABLE local_regulations 
  ADD COLUMN IF NOT EXISTS local_news JSONB;
```

### 2. Install Dependencies

Dependencies are already installed, but if needed:

```bash
npm install fast-xml-parser
```

### 3. Optional: Set Up NewsAPI (Optional)

For additional news sources, you can add a NewsAPI key to your `.env` file:

```bash
NEWS_API_KEY=your_api_key_here
```

Get a free API key at: https://newsapi.org/

**Note**: Google News RSS is free and doesn't require an API key, so NewsAPI is optional.

## Usage

### Fetch News for a Specific City

```bash
npm run fetch-news -- --city "Los Angeles" --state "California" --limit 5
```

### Fetch News for Top Cities

```bash
npm run fetch-news -- --all-cities --limit 5
```

This will fetch news for the top 50 cities (to avoid rate limits).

### Command Options

- `--city "City Name"` - Specific city to fetch news for
- `--state "State Name"` - State for the city
- `--all-cities` - Fetch news for top cities (limited to 50)
- `--limit N` - Maximum articles per city (default: 5)

## How News is Fetched

The script searches for news using these queries:
- "electronics recycling"
- "e-waste recycling"
- "electronic waste"
- "computer recycling"
- "recycling event"

It combines the query with the city and state name (e.g., "electronics recycling Los Angeles California").

## News Storage Format

News articles are stored in the `local_news` JSONB field with this structure:

```json
{
  "articles": [
    {
      "title": "Article Title",
      "link": "https://example.com/article",
      "description": "Article description...",
      "pubDate": "2025-01-25T12:00:00Z",
      "source": "Google News",
      "guid": "unique-identifier"
    }
  ],
  "lastUpdated": "2025-01-25T12:00:00Z",
  "source": "rss_aggregator"
}
```

## Display on City Pages

The `LocalNews.astro` component automatically displays:
- Up to 3 most recent articles (within last 6 months)
- Article title, description, source, and publication date
- Links to original articles (opens in new tab)

The component only shows if there are recent articles available.

## Scheduling Updates

To keep news fresh, you can:

1. **Manual Updates**: Run the script periodically
   ```bash
   npm run fetch-news -- --all-cities
   ```

2. **Automated Updates**: Set up a cron job or scheduled task
   ```bash
   # Example: Run weekly on Sundays at 2 AM
   0 2 * * 0 cd /path/to/project && npm run fetch-news -- --all-cities
   ```

3. **CI/CD Integration**: Add to your deployment pipeline
   ```yaml
   # Example GitHub Actions workflow
   - name: Fetch Local News
     run: npm run fetch-news -- --all-cities
   ```

## Rate Limiting

The script includes delays to avoid rate limiting:
- 1 second delay between RSS feed queries
- 2 second delay between cities when fetching for all cities

If you encounter rate limits:
- Reduce the number of cities fetched
- Increase delays in the script
- Use NewsAPI as an additional source (has its own rate limits)

## Troubleshooting

### No News Appearing

1. **Check if news was fetched**: Query the database
   ```sql
   SELECT city_state, local_news 
   FROM local_regulations 
   WHERE local_news IS NOT NULL;
   ```

2. **Check article dates**: The component only shows articles from the last 6 months

3. **Test RSS feed**: Try accessing the Google News RSS URL directly
   ```
   https://news.google.com/rss/search?q=electronics+recycling+Los+Angeles+California&hl=en&gl=US&ceid=US:en
   ```

### Rate Limiting Issues

If you see rate limiting errors:
- Reduce the number of cities fetched at once
- Increase delays in the script
- Run the script during off-peak hours

## Benefits

✅ **No Scraping Required**: Uses RSS feeds instead of scraping individual websites  
✅ **Free**: Google News RSS is free (no API key needed)  
✅ **Location-Based**: Automatically filters news by city and state  
✅ **Automatic Updates**: Can be scheduled to run periodically  
✅ **Fresh Content**: Shows only recent articles (last 6 months)  
✅ **Scalable**: Can fetch news for multiple cities efficiently  

## Future Enhancements

Potential improvements:
- Add more RSS feed sources (local news sites, government feeds)
- Filter articles by relevance score
- Add article summaries using AI
- Track which articles get clicked
- Add news categories (events, regulations, community initiatives)

