import { XMLParser } from 'fast-xml-parser';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless function to fetch local recycling news via RSS feeds
 * This proxies RSS feeds to handle CORS issues
 * 
 * Vercel automatically detects functions in the /api directory at the root
 * This works in static mode because it's a separate Vercel function, not an Astro route
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const city = typeof req.query.city === 'string' ? req.query.city : req.query.city?.[0];
  const state = typeof req.query.state === 'string' ? req.query.state : req.query.state?.[0];

  if (!city || !state) {
    return res.status(400).json({ error: 'City and state are required' });
  }

  try {
    // Build Google News RSS URL
    const searchQuery = `electronics recycling ${city} ${state}`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en&gl=US&ceid=US:en`;

    // Fetch RSS feed
    const rssResponse = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecyclingNewsBot/1.0)'
      }
    });

    if (!rssResponse.ok) {
      throw new Error(`HTTP error! status: ${rssResponse.status}`);
    }

    const xml = await rssResponse.text();

    // Parse XML using fast-xml-parser
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

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Return articles (limit to 5 most recent)
    return res.status(200).json({
      articles: sortedArticles.slice(0, 5),
      city,
      state
    });

  } catch (error) {
    console.error('News API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Set CORS headers even for errors
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(500).json({
      error: 'Failed to fetch news',
      errorDetails: errorMessage,
      articles: []
    });
  }
}

