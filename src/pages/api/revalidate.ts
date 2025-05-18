import type { APIRoute } from 'astro';

// Secret token for authorization - should be set in environment variables
const REVALIDATION_TOKEN =
  import.meta.env.REVALIDATION_TOKEN || 'your-secret-token-change-me';

export const get: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const path = url.searchParams.get('path');

  // Validate token and path
  if (!token || token !== REVALIDATION_TOKEN) {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid token' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  if (!path) {
    return new Response(
      JSON.stringify({ success: false, message: 'Path parameter is required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    // In Astro with Vercel deployment, we can use fetch to trigger a revalidation
    // This sends a request to the page that needs to be revalidated with a special header
    await fetch(`${url.origin}${path}`, {
      headers: {
        'x-vercel-revalidate': 'true',
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Revalidated path: ${path}`,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Revalidation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error during revalidation',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
