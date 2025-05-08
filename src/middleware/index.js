// Middleware to disable caching for all API requests
export function onRequest({ request, next }) {
  const url = new URL(request.url);

  // Skip middleware for zipfind to avoid conflicts
  if (url.pathname === '/api/zipfind') {
    return next();
  }

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

    // Add different random parameters for zipfind to ensure uniqueness
    if (url.pathname.includes('/zipfind')) {
      url.searchParams.set('_', timestamp);
      url.searchParams.set('r', Math.random().toString(36).substring(2));
      url.searchParams.set('u', Math.random().toString(36).substring(2));
    }

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

    // Add special headers for ZIP code lookups
    if (
      url.pathname.includes('/zipfind') ||
      url.pathname.includes('/zipcode')
    ) {
      newRequest.headers.set('X-Zip-Request', 'true');
      newRequest.headers.set('X-Request-ID', uniqueId);
    }

    // Create a timeout for the API request (apply a 10-second timeout)
    const TIMEOUT_MS = 10000; // 10 seconds timeout
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('API request timed out'));
      }, TIMEOUT_MS);
    });

    // Make the request with a timeout
    const responsePromise = next(newRequest);

    // Race between the response and the timeout
    return Promise.race([responsePromise, timeoutPromise])
      .then((res) => {
        clearTimeout(timeoutId);

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
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('API request failed:', error);

        // Return a proper error response
        return new Response(
          JSON.stringify({
            error: 'Request failed',
            message: error.message || 'Unknown error',
            path: url.pathname,
            timestamp: new Date().toISOString(),
            requestId: uniqueId,
            nocache: uniqueId,
          }),
          {
            status: error.message === 'API request timed out' ? 504 : 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              Pragma: 'no-cache',
              Expires: '0',
              'X-No-Cache': uniqueId,
            },
          }
        );
      });
  }

  // Continue for non-API routes
  return next();
}
