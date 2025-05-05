import { defineMiddleware } from 'astro:middleware';

// Cache durations
const CACHE_DURATIONS = {
  state: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
  },
  city: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
  },
  home: {
    maxAge: 7200, // 2 hours
    staleWhileRevalidate: 172800, // 48 hours
  },
};

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  // Process the request through the rest of the middleware chain and get the response
  const resp = await next();

  // Set cache headers based on route type
  const pathname = url.pathname;

  if (pathname === '/') {
    // Home page caching
    resp.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE_DURATIONS.home.maxAge}, stale-while-revalidate=${CACHE_DURATIONS.home.staleWhileRevalidate}`
    );
  } else if (pathname.match(/^\/states\/[^/]+$/)) {
    // State pages caching
    resp.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE_DURATIONS.state.maxAge}, stale-while-revalidate=${CACHE_DURATIONS.state.staleWhileRevalidate}`
    );
  } else if (pathname.match(/^\/states\/[^/]+\/[^/]+$/)) {
    // City pages caching
    resp.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE_DURATIONS.city.maxAge}, stale-while-revalidate=${CACHE_DURATIONS.city.staleWhileRevalidate}`
    );
  }

  // Add security headers
  resp.headers.set('X-Content-Type-Options', 'nosniff');
  resp.headers.set('X-Frame-Options', 'DENY');
  resp.headers.set('X-XSS-Protection', '1; mode=block');

  return resp;
});
