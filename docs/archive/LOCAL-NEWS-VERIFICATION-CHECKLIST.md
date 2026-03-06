# Local News RSS Integration - Verification Checklist

## ✅ Verified Components

### 1. Database Migration
- ✅ Migration file created: `supabase/migrations/20250125000000_add_local_news_field.sql`
- ✅ Adds `local_news` JSONB field to `local_regulations` table
- ✅ Adds index for querying cities with news
- ✅ Syntax verified

### 2. Script (`scripts/fetch-local-news.js`)
- ✅ Syntax check passed
- ✅ Imports verified (fast-xml-parser, @supabase/supabase-js, node-fetch)
- ✅ Google News RSS URL format correct
- ✅ XML parsing structure handles RSS feed format
- ✅ Database storage logic correct
- ✅ cityStateKey format matches: `"City, State"` (with space after comma)
- ✅ Error handling in place
- ✅ Rate limiting delays included

### 3. Component (`src/components/LocalNews.astro`)
- ✅ Component created and integrated
- ✅ Props interface matches data structure
- ✅ Data access path correct: `localData?.regulations?.local_news?.articles`
- ✅ Date filtering (6 months) implemented
- ✅ Only shows if articles exist
- ✅ No linter errors

### 4. Integration
- ✅ Component imported in city page
- ✅ Component added to city page template
- ✅ TypeScript types updated (`src/types/supabase.ts`)
- ✅ npm script added: `npm run fetch-news`
- ✅ Package dependency installed: `fast-xml-parser`

### 5. Data Flow
- ✅ Script stores: `local_regulations.local_news` (JSONB)
- ✅ Page fetches: `getLocalCityData(cityStateKey)` → returns `{ regulations, stats }`
- ✅ Component receives: `localData.regulations.local_news.articles`
- ✅ cityStateKey format matches: `"City, State"` in both script and page

## ⚠️ Potential Issues to Watch For

### 1. Google News RSS Feed Structure
- Google News RSS feeds may have varying XML structures
- The parser handles common variations, but edge cases may exist
- **Test**: Run script and check if articles are parsed correctly

### 2. Google News Redirect URLs
- Google News RSS links are redirect URLs (news.google.com/...)
- These redirect to the actual article URL
- **Note**: Links will work but may show Google News redirect first

### 3. Rate Limiting
- Google News RSS may rate limit if too many requests
- Script includes 1-2 second delays between requests
- **Recommendation**: Start with a few cities to test

### 4. News Availability
- Not all cities will have recent recycling news
- Component only shows if articles exist (within last 6 months)
- **Expected**: Some cities may not have news displayed

### 5. Database Migration
- Migration needs to be applied to database
- **Action Required**: Run migration before testing

## 🧪 Testing Steps

### 1. Apply Database Migration
```sql
-- Run the migration file or manually:
ALTER TABLE local_regulations 
  ADD COLUMN IF NOT EXISTS local_news JSONB;
```

### 2. Test Script with Single City
```bash
npm run fetch-news -- --city "Los Angeles" --state "California" --limit 5
```

### 3. Verify Database Storage
```sql
SELECT city_state, local_news 
FROM local_regulations 
WHERE local_news IS NOT NULL 
LIMIT 5;
```

### 4. Test Component Display
- Build the site and check a city page that has news
- Verify articles appear in the LocalNews component
- Check that links work (may redirect through Google News)

### 5. Test with Multiple Cities
```bash
npm run fetch-news -- --all-cities --limit 5
```

## 📝 Notes

- **Google News RSS**: Free, no API key required
- **NewsAPI**: Optional, requires API key (set `NEWS_API_KEY` in .env)
- **Article Limit**: Script stores top 5 articles, component shows top 3
- **Date Filter**: Component only shows articles from last 6 months
- **cityStateKey Format**: Must match exactly: `"City, State"` (with space after comma)

## 🔧 Troubleshooting

### No Articles Found
1. Check if RSS feed is accessible
2. Verify search query format
3. Check if city has recent recycling news
4. Review console logs for errors

### Articles Not Displaying
1. Verify database has `local_news` data
2. Check `cityStateKey` format matches
3. Verify articles are within 6 months
4. Check component props are passed correctly

### Rate Limiting Errors
1. Increase delays in script
2. Reduce number of cities fetched
3. Run script during off-peak hours
4. Consider using NewsAPI as additional source

