import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// Explicitly mark this as an edge function for Vercel
export const config = {
  runtime: 'edge',
  // Bypass Vercel's edge cache completely
  cache: 'no-store',
  maxDuration: 60,
  regions: ['iad1'], // Use a consistent region
  unstable_allowDynamic: ['**/*.node'],
  // Explicitly disable all caching mechanisms
  caching: {
    edge: false,
    browser: false,
    header: 'no-cache, no-store, must-revalidate',
  },
};

// Include CORS headers for all responses with no-cache directives
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-No-Cache',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
  'Vercel-CDN-Cache-Control': 'no-cache, no-store, bypass',
  'CDN-Cache-Control': 'no-cache, no-store',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
  'Edge-Control': 'no-store',
  Vary: '*',
  'X-Vercel-Cache': 'BYPASS',
  'X-Middleware-Cache': 'no-cache',
  'X-Vercel-Skip-Cache': 'true',
  'X-Cache-Buster': new Date().toISOString(),
  'X-No-Cache': `${Date.now()}_${Math.random().toString(36).substring(2)}`,
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
    // Generate request ID for tracking
    const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Parse the request body
    const body = await request.json();
    const { city, state, zip } = body;

    console.log(
      `Fetching recycling centers for ${city}, ${state} (ZIP: ${zip}, Request ID: ${requestId})`
    );

    if (!city || !state) {
      return createResponse(
        {
          error: 'Missing city or state parameter',
          timestamp: Date.now(),
          requestId,
        },
        400
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

      // Return the fuzzy results with dynamic cache prevention
      return createResponse(
        {
          data: fuzzyResults || [],
          fuzzy: true,
          count: fuzzyResults?.length || 0,
          requestId,
          timestamp: Date.now(),
          requestedCity: city,
          requestedState: state,
          requestedZip: zip,
        },
        200
      );
    }

    // Return the centers with dynamic cache prevention
    return createResponse(
      {
        data: centers,
        fuzzy: false,
        count: centers.length,
        requestId,
        timestamp: Date.now(),
        requestedCity: city,
        requestedState: state,
        requestedZip: zip,
      },
      200
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        noCacheFlag: Math.random().toString(36).substring(2),
      },
      500
    );
  }
};

// Helper function to create a response with dynamic cache prevention headers
function createResponse(data: any, status: number = 200): Response {
  // Add dynamic timestamp and cache busters
  if (typeof data === 'object' && data !== null) {
    data.timestamp = new Date().toISOString();
    data.unixTime = Date.now();
    data.cacheHash = Math.random().toString(36).substring(2, 15);
    data.nocache = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  // Generate dynamic headers for each response
  const dynamicHeaders = {
    ...corsHeaders,
    'X-Cache-Buster': Date.now().toString(),
    'X-Request-Time': Date.now().toString(),
    'X-No-Cache': `${Date.now()}_${Math.random().toString(36).substring(2)}`,
    'Vercel-CDN-Cache-Control': 'no-cache, no-store, bypass',
    'CDN-Cache-Control': 'no-cache, no-store',
    Vary: '*',
    Age: '0',
  };

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: dynamicHeaders,
  });
}

// Support for OPTIONS requests for CORS
export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};
