// This file contains route segment config to disable cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Use the OPTIONS handler as a simple ping endpoint for the API
import type { APIRoute } from 'astro';

export const OPTIONS: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: Date.now(),
      nocache: Math.random().toString(36).substring(2),
      message: 'This API endpoint has caching completely disabled',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Vercel-CDN-Cache-Control': 'no-cache, no-store, bypass',
        'CDN-Cache-Control': 'no-cache, no-store',
        'X-Cache-Buster': Date.now().toString(),
      },
    }
  );
};
