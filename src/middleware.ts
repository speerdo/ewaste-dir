import { defineMiddleware } from 'astro:middleware';

// Cache durations
const CACHE_DURATIONS = {
  static: {
    maxAge: 86400, // 24 hours
    staleWhileRevalidate: 604800, // 7 days
  },
  state: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
  },
  city: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
  },
  api: {
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 3600, // 1 hour
  },
};

// Static pages that should be cached longer
const STATIC_PAGES = new Set(['/', '/about', '/contact', '/blog']);

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  // Process the request through the rest of the middleware chain and get the response
  const resp = await next();
  const pathname = url.pathname;

  // Set cache headers based on route type
  if (STATIC_PAGES.has(pathname)) {
    // Static pages caching with ISR
    resp.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE_DURATIONS.static.maxAge}, stale-while-revalidate=${CACHE_DURATIONS.static.staleWhileRevalidate}`
    );
    resp.headers.set('X-Middleware-Cache', 'static');
  } else if (pathname.match(/^\/states\/[^/]+$/)) {
    // State pages caching (SSR)
    resp.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE_DURATIONS.state.maxAge}, stale-while-revalidate=${CACHE_DURATIONS.state.staleWhileRevalidate}`
    );
    resp.headers.set('X-Middleware-Cache', 'state');
  } else if (pathname.match(/^\/states\/[^/]+\/[^/]+$/)) {
    // City pages caching (SSR)
    resp.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE_DURATIONS.city.maxAge}, stale-while-revalidate=${CACHE_DURATIONS.city.staleWhileRevalidate}`
    );
    resp.headers.set('X-Middleware-Cache', 'city');
  } else if (pathname.startsWith('/api/')) {
    // API endpoints caching
    resp.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE_DURATIONS.api.maxAge}, stale-while-revalidate=${CACHE_DURATIONS.api.staleWhileRevalidate}`
    );
    resp.headers.set('X-Middleware-Cache', 'api');
  }

  // Add security headers
  resp.headers.set('X-Content-Type-Options', 'nosniff');
  resp.headers.set('X-Frame-Options', 'DENY');
  resp.headers.set('X-XSS-Protection', '1; mode=block');
  resp.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  resp.headers.set('Permissions-Policy', 'geolocation=self');

  // Add performance headers
  resp.headers.set('X-Vercel-Cache', 'MISS'); // Let Vercel handle the actual cache status
  resp.headers.set('Server-Timing', 'miss, db;dur=53, app;dur=47.2');
  resp.headers.set('Vary', 'Accept-Encoding');

  return resp;
});
