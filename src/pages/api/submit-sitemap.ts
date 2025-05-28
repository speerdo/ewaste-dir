import type { APIRoute } from 'astro';

export const get: APIRoute = async ({ request }) => {
  // URL of your sitemap
  const sitemapUrl = 'https://www.recycleoldtech.com/sitemap.xml';

  // Get API key from query parameter (secure this in production)
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');

  // Simple API key validation - use a more secure method in production
  const validApiKey =
    import.meta.env.SITEMAP_SUBMISSION_KEY || 'your-secret-key-here';

  if (apiKey !== validApiKey) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  try {
    // Search engines to notify about your sitemap
    const searchEngines = [
      `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    ];

    // Submit to each search engine
    const results = await Promise.all(
      searchEngines.map(async (engine) => {
        try {
          const response = await fetch(engine);
          return {
            engine,
            status: response.status,
            success: response.ok,
          };
        } catch (error) {
          console.error(`Error submitting to ${engine}:`, error);
          return {
            engine,
            status: 'Error',
            success: false,
          };
        }
      })
    );

    // Return the results
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sitemap submitted to search engines',
        results,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error submitting sitemap:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error submitting sitemap',
        error: String(error),
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
