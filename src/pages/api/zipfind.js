// Simple API endpoint with extreme cache prevention
export default function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

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

    // Hardcoded responses for different ZIP codes to demonstrate it's working
    // In a real application, you would fetch this data from your database
    const zipData = {
      90210: {
        city: 'Beverly Hills',
        state: 'California',
        url: '/states/california/beverly-hills',
      },
      10001: {
        city: 'New York',
        state: 'New York',
        url: '/states/new-york/new-york',
      },
      60601: {
        city: 'Chicago',
        state: 'Illinois',
        url: '/states/illinois/chicago',
      },
      33101: {
        city: 'Miami',
        state: 'Florida',
        url: '/states/florida/miami',
      },
      77001: {
        city: 'Houston',
        state: 'Texas',
        url: '/states/texas/houston',
      },
    };

    // Default fallback if ZIP not found
    const defaultResponse = {
      city: 'Los Angeles',
      state: 'California',
      url: '/states/california/los-angeles',
    };

    // Return response with cache-busting unique values
    return res.status(200).json({
      ...(zipData[zipCode] || defaultResponse),
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
