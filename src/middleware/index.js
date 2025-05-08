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
    url.searchParams.set('_t', timestamp);
    url.searchParams.set('_r', randomValue);

    // Create a new request with the modified URL
    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      redirect: request.redirect,
      signal: request.signal,
    });

    // Add cache-busting headers to the request
    newRequest.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate'
    );
    newRequest.headers.set('Pragma', 'no-cache');
    newRequest.headers.set('Expires', '0');
    newRequest.headers.set('X-No-Cache', uniqueId);

    // Make the request
    const response = next(newRequest);

    // Add cache prevention headers to the response
    return response.then((res) => {
      const newHeaders = new Headers(res.headers);

      newHeaders.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      newHeaders.set('CDN-Cache-Control', 'no-store');
      newHeaders.set('Vercel-CDN-Cache-Control', 'no-store');
      newHeaders.set('Surrogate-Control', 'no-store');
      newHeaders.set('Edge-Control', 'no-store');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      newHeaders.set('X-No-Cache', uniqueId);
      newHeaders.set('X-Vercel-Skip-Cache', 'true');
      newHeaders.set('Vary', '*');

      // Set content type for API responses if not already set
      if (
        res.headers.get('content-type') === null &&
        url.pathname.includes('/api/')
      ) {
        newHeaders.set('Content-Type', 'application/json');
      }

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: newHeaders,
      });
    });
  }

  // Continue for non-API routes
  return next();
}
