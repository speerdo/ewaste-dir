// Middleware to disable caching for all API requests
export function onRequest({ request, next }) {
  const url = new URL(request.url);

  // Only apply to API routes
  if (url.pathname.startsWith('/api/')) {
    // Create a unique request identifier
    const timestamp = Date.now();
    const randomValue = Math.random().toString(36).substring(2, 15);
    const uniqueId = `${timestamp}_${randomValue}`;

    // Add a unique parameter to the URL to force cache miss
    url.searchParams.set('_nocache', uniqueId);

    // Create a new request with the modified URL
    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: request.redirect,
      signal: request.signal,
    });

    // Add cache prevention headers
    const response = next(newRequest);

    // Add cache prevention headers to the response
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    response.headers.set('Surrogate-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-No-Cache', uniqueId);

    return response;
  }

  // Continue for non-API routes
  return next();
}
