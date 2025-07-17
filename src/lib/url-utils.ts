/**
 * URL utilities for ensuring consistent URL handling across the site
 */

// Production domain - always use this for absolute URLs in production
export const PRODUCTION_URL = 'https://www.recycleoldtech.com';

/**
 * Get the site base URL depending on environment
 * @returns The site URL (production URL in production, origin in development)
 */
export function getSiteUrl(): string {
  return import.meta.env.PROD ? PRODUCTION_URL : '';
}

/**
 * Normalize a URL path to ensure consistency
 * @param path The URL path
 * @returns The normalized path
 */
export function normalizeUrlPath(path: string): string {
  // Remove trailing slash (except for root)
  let normalized = path === '/' ? path : path.replace(/\/$/, '');

  // Remove query parameters and fragments for canonical URLs
  normalized = normalized.split('?')[0].split('#')[0];

  // Ensure path starts with slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  return normalized;
}

/**
 * Create an absolute URL for any path
 * @param path The relative path
 * @returns The absolute URL with proper domain
 */
export function getAbsoluteUrl(path: string): string {
  try {
    // If it's already an absolute URL, return it
    new URL(path);
    return path;
  } catch {
    // If it's a relative path, make it absolute with the production URL in production
    const baseUrl = getSiteUrl();

    // Normalize the path
    const normalizedPath = normalizeUrlPath(path);

    // In production, use the production URL; in development, use relative URLs
    return import.meta.env.PROD
      ? new URL(normalizedPath, PRODUCTION_URL).toString()
      : normalizedPath;
  }
}

/**
 * Convert a request URL to a canonical URL that uses the production domain
 * @param requestUrl The current request URL
 * @returns The canonical URL with the production domain
 */
export function getCanonicalUrl(requestUrl: URL | string): string {
  const url = typeof requestUrl === 'string' ? new URL(requestUrl) : requestUrl;

  // Normalize the pathname to ensure consistency
  const normalizedPath = normalizeUrlPath(url.pathname);

  // Only include search parameters that are canonically meaningful
  // For most cases, we don't want query parameters in canonical URLs
  const canonicalUrl = new URL(normalizedPath, PRODUCTION_URL);

  return canonicalUrl.toString();
}

/**
 * Get a sharing URL for social media platforms
 * @param requestUrl The current request URL
 * @returns A URL suitable for sharing on social media
 */
export function getSharingUrl(requestUrl: URL | string): string {
  return getCanonicalUrl(requestUrl);
}

/**
 * Check if a URL should be considered canonical
 * @param url The URL to check
 * @returns True if the URL is canonical
 */
export function isCanonicalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Check for non-canonical patterns
    if (urlObj.search) return false; // Has query parameters
    if (urlObj.hash) return false; // Has fragments
    if (urlObj.pathname.includes('/page/')) return false; // Pagination
    if (urlObj.pathname.includes('/search')) return false; // Search results
    if (urlObj.pathname.includes('/api/')) return false; // API endpoints
    if (urlObj.pathname.includes('/debug')) return false; // Debug pages
    if (urlObj.pathname.endsWith('/') && urlObj.pathname !== '/') return false; // Trailing slash (except root)

    // Check if it uses the production domain in production
    if (import.meta.env.PROD && urlObj.origin !== PRODUCTION_URL) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a canonical URL for a given path
 * @param path The URL path
 * @returns The canonical URL
 */
export function generateCanonicalUrl(path: string): string {
  const normalizedPath = normalizeUrlPath(path);
  return new URL(normalizedPath, PRODUCTION_URL).toString();
}
