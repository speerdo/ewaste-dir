import { getAllStates, getCitiesByState } from '../lib/supabase';
import { getCollection } from 'astro:content';
import {
  generateCanonicalUrl,
  isCanonicalUrl,
  PRODUCTION_URL,
} from '../lib/url-utils';
import type { APIRoute } from 'astro';

// export const prerender = false; // Commented out - Vercel will handle this as serverless function

export const GET: APIRoute = async () => {
  const states = await getAllStates();

  // Get all blog posts
  const blogPosts = await getCollection('blog');

  let urls: Array<{ loc: string; lastmod?: string }> = [];

  // Add static URLs with canonical formatting
  const staticUrls = [
    '/',
    '/about',
    '/contact',
    '/privacy',
    '/recycling-guide',
    '/thanks',
    '/blog',
  ];

  for (const staticUrl of staticUrls) {
    const canonicalUrl = generateCanonicalUrl(staticUrl);
    if (isCanonicalUrl(canonicalUrl)) {
      urls.push({ loc: canonicalUrl });
    }
  }

  // Add blog post URLs
  for (const post of blogPosts) {
    const blogUrl = `/blog/${post.slug}`;
    const canonicalUrl = generateCanonicalUrl(blogUrl);
    if (isCanonicalUrl(canonicalUrl)) {
      urls.push({
        loc: canonicalUrl,
        lastmod: post.data.pubDate
          ? new Date(post.data.pubDate).toISOString()
          : undefined,
      });
    }
  }

  // Add dynamic state and city URLs
  for (const state of states) {
    // Add state URL
    const stateUrl = `/states/${state.id}`;
    const canonicalStateUrl = generateCanonicalUrl(stateUrl);
    if (isCanonicalUrl(canonicalStateUrl)) {
      urls.push({ loc: canonicalStateUrl });
    }

    // Add city URLs
    try {
      const cities = await getCitiesByState(state.id);
      for (const city of cities) {
        const cityUrl = `/states/${state.id}/${city.id}`;
        const canonicalCityUrl = generateCanonicalUrl(cityUrl);
        if (isCanonicalUrl(canonicalCityUrl)) {
          urls.push({ loc: canonicalCityUrl });
        }
      }
    } catch (error) {
      console.error(`Error fetching cities for state ${state.id}:`, error);
      // Continue with other states even if one fails
    }
  }

  // Remove duplicates based on URL (just in case)
  const uniqueUrls = urls.filter(
    (url, index, self) => index === self.findIndex((u) => u.loc === url.loc)
  );

  // Sort URLs alphabetically for consistency
  uniqueUrls.sort((a, b) => a.loc.localeCompare(b.loc));

  // Generate XML sitemap
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>${
      url.lastmod
        ? `
    <lastmod>${url.lastmod}</lastmod>`
        : ''
    }
    <changefreq>weekly</changefreq>
    <priority>${getPriority(url.loc)}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};

/**
 * Get priority for URL based on page type
 * @param url The URL
 * @returns Priority value between 0.0 and 1.0
 */
function getPriority(url: string): string {
  if (url === PRODUCTION_URL + '/') return '1.0';
  if (url.includes('/blog/')) return '0.7';
  if (url.includes('/states/') && url.split('/').length === 5) return '0.8'; // State pages
  if (url.includes('/states/') && url.split('/').length === 6) return '0.9'; // City pages
  return '0.6';
}
