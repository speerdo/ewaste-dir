/**
 * Shared Cache-Control values for Vercel CDN (s-maxage) and browsers (max-age).
 */

/** News API: refresh at origin every 6h; serve stale up to 12h while revalidating. */
export const NEWS_API_CACHE_CONTROL =
  'public, s-maxage=21600, stale-while-revalidate=43200, max-age=3600';

/** Static directory pages (city/state/blog): long edge cache, weekly SWR. */
export const STATIC_HTML_CACHE_CONTROL =
  'public, s-maxage=86400, stale-while-revalidate=604800, max-age=3600';
