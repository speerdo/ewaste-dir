import type { APIRoute } from 'astro';
import { getAllCityStatePairs } from '../../../lib/cityData';
import { searchLocations } from '../../../lib/cityData';

export const prerender = false; // API routes need to be server-side

export const GET: APIRoute = async ({ url }): Promise<Response> => {
  try {
    const query = url.searchParams.get('q')?.toLowerCase().trim() || '';

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Get all city-state pairs
    const cityStatePairs = await getAllCityStatePairs();

    // Use the shared search function
    const suggestions = searchLocations(query, cityStatePairs);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to get search suggestions',
        details: error instanceof Error ? error.message : 'Unknown error',
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
