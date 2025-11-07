import type { APIRoute } from 'astro';
import { XMLParser } from 'fast-xml-parser';

/**
 * API endpoint to fetch local recycling news via RSS feeds
 * This proxies RSS feeds to handle CORS issues
 * 
 * Note: In static mode, this will be handled by Vercel as a serverless function
 */
// In static mode, Vercel automatically handles /api/* routes as serverless functions
// We don't set prerender = false here because it would break static builds
// Vercel will detect and handle this route automatically at runtime

export const GET: APIRoute = async ({ url, request }) => {
  // Handle OPTIONS for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
  
  const city = url.searchParams.get('city');
  const state = url.searchParams.get('state');
  
  if (!city || !state) {
    return new Response(JSON.stringify({ error: 'City and state are required' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  try {
    // Build Google News RSS URL
    const searchQuery = `electronics recycling ${city} ${state}`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en&gl=US&ceid=US:en`;
    
    // Fetch RSS feed
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecyclingNewsBot/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xml = await response.text();
    
    // Parse XML using fast-xml-parser (works in Node.js)
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: false,
      parseTagValue: false
    });
    
    const result = parser.parse(xml);
    const items = result.rss?.channel?.item || [];
    
    // Handle single item vs array
    const itemsArray = Array.isArray(items) ? items : [items];
    
    const articles = itemsArray.map((item: any) => {
      const title = item.title || '';
      const link = item.link || '';
      const description = item.description || '';
      const pubDate = item.pubDate || '';
      const source = item.source?.['@_url'] || item.source?.['#text'] || item.source || 'Google News';
      
      // Extract image from description (Google News often includes images in description)
      let image = '';
      if (description) {
        // Try to find img tag in description
        const imgMatch = description.match(/<img[^>]+src="([^"]+)"/i);
        if (imgMatch && imgMatch[1]) {
          image = imgMatch[1];
        } else {
          // Try to find image URL in description text
          const urlMatch = description.match(/(https?:\/\/[^\s<>"]+\.(jpg|jpeg|png|gif|webp))/i);
          if (urlMatch && urlMatch[1]) {
            image = urlMatch[1];
          }
        }
      }
      
      // Try media:content or media:thumbnail (some RSS feeds use these)
      const mediaContent = item['media:content']?.['@_url'] || 
                          item['media:thumbnail']?.['@_url'] ||
                          item.content?.['@_url'] ||
                          item.thumbnail?.['@_url'] || '';
      if (mediaContent && !image) {
        image = mediaContent;
      }
      
      // Clean description (remove HTML tags for display)
      const cleanDescription = description
        ? description.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
        : '';
      
      // Parse date for sorting
      const articleDate = pubDate ? new Date(pubDate) : new Date();
      
      return {
        title,
        link,
        description: cleanDescription,
        image,
        pubDate: articleDate.toISOString(),
        source,
        _sortDate: articleDate.getTime() // Internal field for sorting
      };
    });
    
    // Sort articles by date (newest first) - remove _sortDate before returning
    const sortedArticles = articles
      .sort((a, b) => {
        // Sort by date descending (newest first)
        const dateA = a._sortDate || 0;
        const dateB = b._sortDate || 0;
        return dateB - dateA;
      })
      .map(({ _sortDate, ...article }) => article); // Remove internal sort field
    
    // Return articles (limit to 5 most recent)
    return new Response(JSON.stringify({
      articles: sortedArticles.slice(0, 5),
      city,
      state
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('News API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch news',
      errorDetails: errorMessage,
      articles: []
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

