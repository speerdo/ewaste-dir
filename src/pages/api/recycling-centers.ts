import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// Include CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Process a POST request with city/state parameters
export const POST: APIRoute = async ({ request }) => {
  // First check if this is a preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Parse the request body
    const body = await request.json();
    const { city, state, zip } = body;

    console.log(
      `Fetching recycling centers for ${city}, ${state} (ZIP: ${zip})`
    );

    if (!city || !state) {
      return new Response(
        JSON.stringify({
          error: 'Missing city or state parameter',
          timestamp: Date.now(),
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    // Query the database for recycling centers in this city and state
    // We'll look for a direct city match first
    const { data: centers, error } = await supabase
      .from('recycling_centers')
      .select(
        'id, name, address, city, state, latitude, longitude, postal_code, website'
      )
      .eq('city', city)
      .eq('state', state)
      .limit(10);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // If no results, try a case-insensitive search
    if (!centers || centers.length === 0) {
      const { data: fuzzyResults, error: fuzzyError } = await supabase
        .from('recycling_centers')
        .select(
          'id, name, address, city, state, latitude, longitude, postal_code, website'
        )
        .ilike('city', `%${city}%`)
        .eq('state', state)
        .limit(10);

      if (fuzzyError) {
        console.error('Database error on fuzzy search:', fuzzyError);
        throw fuzzyError;
      }

      // Return the fuzzy results
      return new Response(JSON.stringify(fuzzyResults || [], null, 2), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    // Return the centers
    return new Response(JSON.stringify(centers, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  }
};

// Support for OPTIONS requests for CORS
export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};
