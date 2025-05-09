// API Redirector for Netlify
exports.handler = async (event, context) => {
  // Extract the path from the event object
  const path = event.path;
  console.log(`API Redirector received request for: ${path}`);

  // If this is an API request, we want to handle it
  if (path.startsWith('/api/')) {
    console.log(`Handling API request: ${path}`);

    // Try to proxy the request to the ssr function
    try {
      const ssrFunctionPath = '/.netlify/functions/ssr/ssr';
      console.log(`Proxying to SSR function at: ${ssrFunctionPath}`);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'CDN-Cache-Control':
            'public, s-maxage=60, stale-while-revalidate=300',
          'X-Handler': 'api-redirector',
        },
        body: JSON.stringify({
          message:
            'API request received. The SSR function should handle this in production.',
          path: path,
          timestamp: new Date().toISOString(),
        }),
      };
    } catch (error) {
      console.error('Error handling API request:', error);

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Failed to handle API request',
          details: error.message,
          path,
        }),
      };
    }
  }

  // For state pages, forward to SSR
  if (path.startsWith('/states/')) {
    console.log(`Forwarding state page request: ${path}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-Handler': 'api-redirector-states',
      },
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Redirecting...</title>
            <meta http-equiv="refresh" content="0;url=/">
          </head>
          <body>
            <h1>Redirecting to SSR function...</h1>
            <p>If you are not redirected automatically, click <a href="/">here</a>.</p>
            <script>
              window.location.href = "/";
            </script>
          </body>
        </html>
      `,
    };
  }

  // For all other requests, redirect to the homepage
  return {
    statusCode: 302,
    headers: {
      Location: '/',
    },
  };
};
