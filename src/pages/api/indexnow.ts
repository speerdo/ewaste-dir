import type { APIRoute } from 'astro';

export const get: APIRoute = async ({ request, redirect }) => {
  // Your IndexNow key - MUST match the one in your indexnow.txt file
  const INDEXNOW_KEY = '7e14b2eb6b5e48a38b08d888b1a2da2c';

  // Get URL parameters
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const urlToIndex = url.searchParams.get('url');

  // Validate the key
  if (key !== INDEXNOW_KEY) {
    return new Response('Invalid key', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  // Validate the URL
  if (!urlToIndex) {
    return new Response('Missing URL parameter', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  try {
    // Verify the URL belongs to our domain
    const urlObj = new URL(urlToIndex);
    const allowedDomains = ['recycleoldtech.com', 'www.recycleoldtech.com'];

    if (!allowedDomains.includes(urlObj.hostname)) {
      return new Response('URL must be from our domain', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // Send the URL to Bing/IndexNow API
    await submitToIndexNow(INDEXNOW_KEY, urlToIndex);

    return new Response('URL submitted for indexing', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error('IndexNow API error:', error);
    return new Response('Error processing request', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
};

async function submitToIndexNow(key: string, url: string) {
  // IndexNow submission format
  const payload = {
    host: 'www.recycleoldtech.com',
    key: key,
    urlList: [url],
  };

  // Submit to the IndexNow API
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `IndexNow API error: ${response.status} ${response.statusText}`
    );
  }

  return await response.text();
}
