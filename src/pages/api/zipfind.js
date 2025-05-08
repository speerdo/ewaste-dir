// Simple API endpoint with extreme cache prevention
export const GET = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const zipCode = url.searchParams.get('zip');

  // Create response object to return
  const headers = new Headers();

  // Allow CORS
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, X-Requested-With'
  );
  headers.set('Access-Control-Max-Age', '86400');

  // Set most aggressive anti-cache headers possible
  headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  );
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('Surrogate-Control', 'no-store');

  // Vercel-specific cache headers
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Vercel-CDN-Cache-Control', 'no-store');
  headers.set('X-Vercel-Cache', 'BYPASS');
  headers.set('X-Vercel-Skip-Cache', 'true');
  headers.set('Edge-Control', 'no-store');
  headers.set('X-Middleware-Cache', 'no-cache');

  // Set Vary header to all to prevent cache sharing
  headers.set('Vary', '*');

  // Add content type for JSON response
  headers.set('Content-Type', 'application/json');

  // Handle the request
  try {
    const timestamp = Date.now();
    const requestId = `req_${timestamp}_${Math.floor(Math.random() * 10000)}`;

    if (!zipCode) {
      return new Response(
        JSON.stringify({
          error: 'Missing ZIP code',
          timestamp,
          requestId,
          nocache: `${timestamp}_${Math.random().toString(36).substring(2)}`,
        }),
        {
          status: 400,
          headers,
        }
      );
    }

    // Use the search functionality to find a matching location from the global data
    // In a real implementation, you would query a database or external API here
    // We're using the client-side data that's already loaded globally in the frontend

    // Since we can't directly access window.__CITY_STATE_PAIRS__, we'll return
    // a response that instructs the client to look up the data locally
    return new Response(
      JSON.stringify({
        status: 'success',
        action: 'client_lookup',
        requestedZip: zipCode,
        requestId,
        timestamp: new Date().toISOString(),
        unixTime: timestamp,
        nocache: `${timestamp}_${Math.random().toString(36).substring(2)}`,
        uniqueValue: Math.random().toString(36).substring(2),
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        nocache: `${Date.now()}_${Math.random().toString(36).substring(2)}`,
      }),
      {
        status: 500,
        headers,
      }
    );
  }
};

// Handle OPTIONS request for CORS
export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Accept, X-Requested-With, X-No-Cache',
      'Access-Control-Max-Age': '86400',
    },
  });
};

// Also add POST handler for backward compatibility
export const POST = async (context) => {
  const { request } = context;
  let zipCode;

  try {
    const body = await request.json();
    zipCode = body?.zip;
  } catch (e) {
    // If JSON parse fails, try reading as form data
    try {
      const formData = await request.formData();
      zipCode = formData.get('zip');
    } catch (formError) {
      zipCode = null;
    }
  }

  // Create a new URL with the zip as query parameter
  const url = new URL(request.url);
  if (zipCode) {
    url.searchParams.set('zip', zipCode);
  }

  // Create a new request with the updated URL
  const newRequest = new Request(url, {
    method: 'GET',
    headers: request.headers,
  });

  // Reuse the GET handler
  return GET({ request: newRequest });
};
