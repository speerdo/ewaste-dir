# Local News - Client-Side RSS Fetching

## Overview

This system fetches location-based recycling news **client-side** when a user visits a city page. News is fetched from Google News RSS feeds via an API endpoint that handles CORS issues.

## How It Works

1. **User visits city page** → Page loads with LocalNews component
2. **JavaScript runs in browser** → Fetches news from `/api/news?city=X&state=Y`
3. **API endpoint proxies RSS feed** → Fetches Google News RSS and parses XML
4. **News displayed** → Shows up to 3 recent articles (within last 6 months)

## Benefits

✅ **No database storage needed** - News is fetched fresh on each page load  
✅ **No build-time overhead** - Doesn't slow down static site generation  
✅ **Always fresh content** - News is current when users visit  
✅ **No rate limiting during builds** - Only fetches when users visit pages  
✅ **Simple architecture** - No scheduled jobs or database updates needed  

## Architecture

```
User Browser → LocalNews Component → /api/news → Google News RSS → Display Articles
```

### Components

1. **`src/components/LocalNews.astro`** - Client-side component that fetches and displays news
2. **`src/pages/api/news.ts`** - API endpoint that proxies RSS feeds (handles CORS)

## API Endpoint

**URL:** `/api/news?city={cityName}&state={stateName}`

**Example:**
```
GET /api/news?city=Los%20Angeles&state=California
```

**Response:**
```json
{
  "articles": [
    {
      "title": "Article Title",
      "link": "https://...",
      "description": "Article description...",
      "pubDate": "2025-01-25T12:00:00Z",
      "source": "Google News"
    }
  ],
  "city": "Los Angeles",
  "state": "California"
}
```

## Features

- **Automatic filtering**: Only shows articles from last 6 months
- **Limit to 3 articles**: Shows most recent 3 articles
- **Error handling**: Gracefully handles failures (hides section if no news)
- **Loading state**: Shows loading spinner while fetching
- **CORS handling**: API endpoint proxies RSS to avoid CORS issues

## Caching

The API endpoint includes cache headers:
- `Cache-Control: public, max-age=3600` (1 hour cache)

This means:
- Same city/state requests within 1 hour return cached results
- Reduces load on Google News RSS feeds
- Still fresh enough for users

## Error Handling

If news cannot be fetched:
- Component hides itself (no error message shown)
- User experience is not disrupted
- Console logs error for debugging

## No Database Required

Unlike the previous approach, this implementation:
- ❌ **No database migration needed**
- ❌ **No scheduled scripts needed**
- ❌ **No database storage needed**
- ✅ **Just works** - Fetches when users visit pages

## Testing

### Test API Endpoint Directly

```bash
curl "http://localhost:4321/api/news?city=Los%20Angeles&state=California"
```

### Test in Browser

1. Visit a city page (e.g., `/states/california/los-angeles`)
2. Open browser DevTools → Network tab
3. Look for request to `/api/news?city=...&state=...`
4. Check response and verify articles display

## Troubleshooting

### No News Appearing

1. **Check API endpoint**: Visit `/api/news?city=X&state=Y` directly
2. **Check browser console**: Look for JavaScript errors
3. **Check network tab**: Verify API request is successful
4. **Check RSS feed**: Google News RSS might not have results for that city

### CORS Errors

- The API endpoint should handle CORS automatically
- If you see CORS errors, check that the API route is working
- Verify `export const prerender = false;` is set in the API route

### Rate Limiting

- Google News RSS may rate limit if too many requests
- The API endpoint caches responses for 1 hour
- If issues persist, consider adding more caching or delays

## Future Enhancements

Potential improvements:
- Add more RSS feed sources (local news sites, government feeds)
- Add article relevance scoring
- Add user preferences (show/hide news section)
- Add news categories (events, regulations, community initiatives)

