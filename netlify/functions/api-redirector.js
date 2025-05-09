// Simple redirector for API requests
exports.handler = async (event, context) => {
  // Extract the path from the event object
  const path = event.path;
  console.log(`API Redirector received request for: ${path}`);

  // If this is an API request, we want to pass it to the entry function
  if (path.startsWith('/api/')) {
    console.log(`Redirecting API request to entry function: ${path}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
      body: JSON.stringify({
        message: 'API handler is initializing. Please try again in a moment.',
        path: path,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // For non-API requests, just redirect to the homepage
  return {
    statusCode: 302,
    headers: {
      Location: '/',
    },
  };
};
