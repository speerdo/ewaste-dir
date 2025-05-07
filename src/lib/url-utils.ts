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
  // Use window.location.origin when in browser environment
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Use PRODUCTION_URL for server-side code in production
  return import.meta.env.PROD ? PRODUCTION_URL : '';
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

    // Ensure the path starts with a slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

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
  return import.meta.env.PROD
    ? new URL(url.pathname + url.search, PRODUCTION_URL).toString()
    : url.toString();
}

/**
 * Get a sharing URL for social media platforms
 * @param requestUrl The current request URL
 * @returns A URL suitable for sharing on social media
 */
export function getSharingUrl(requestUrl: URL | string): string {
  return getCanonicalUrl(requestUrl);
}
