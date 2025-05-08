// Simple API endpoint with extreme cache prevention
export default function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, X-Requested-With'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  // Set most aggressive anti-cache headers possible
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Vercel-specific cache headers
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Vercel-Cache', 'BYPASS');
  res.setHeader('X-Vercel-Skip-Cache', 'true');
  res.setHeader('Edge-Control', 'no-store');
  res.setHeader('X-Middleware-Cache', 'no-cache');

  // Set Vary header to all to prevent cache sharing
  res.setHeader('Vary', '*');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get ZIP code from query parameters or body
  let zipCode;
  const timestamp = Date.now();
  const requestId = `req_${timestamp}_${Math.floor(Math.random() * 10000)}`;

  try {
    if (req.method === 'GET') {
      zipCode = req.query.zip;
    } else if (req.method === 'POST') {
      zipCode = req.body?.zip;
    }

    if (!zipCode) {
      return res.status(400).json({
        error: 'Missing ZIP code',
        timestamp,
        requestId,
        nocache: `${timestamp}_${Math.random().toString(36).substring(2)}`,
      });
    }

    // Use the search functionality to find a matching location from the global data
    // In a real implementation, you would query a database or external API here
    // We're using the client-side data that's already loaded globally in the frontend

    // Since we can't directly access window.__CITY_STATE_PAIRS__, we'll return
    // a response that instructs the client to look up the data locally
    return res.status(200).json({
      status: 'success',
      action: 'client_lookup',
      requestedZip: zipCode,
      requestId,
      timestamp: new Date().toISOString(),
      unixTime: timestamp,
      nocache: `${timestamp}_${Math.random().toString(36).substring(2)}`,
      uniqueValue: Math.random().toString(36).substring(2),
    });
  } catch (error) {
    console.error('Error processing request:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      requestId,
      nocache: `${timestamp}_${Math.random().toString(36).substring(2)}`,
    });
  }
}
