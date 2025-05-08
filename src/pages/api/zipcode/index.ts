import { createClient } from '@supabase/supabase-js';
import type { APIRoute } from 'astro';

export interface ZipCodeResponse {
  city: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface ZipCodeErrorResponse {
  error: string;
  details?: Record<string, any>;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export const config = {
  runtime: 'edge',
};

// Initialize Supabase client
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const handler: APIRoute = async ({ request }): Promise<Response> => {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
          details: { method: request.method },
        } satisfies ZipCodeErrorResponse),
        {
          status: 405,
          headers: corsHeaders,
        }
      );
    }

    // Validate content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return new Response(
        JSON.stringify({
          error: 'Invalid Content-Type',
          details: {
            expected: 'application/json',
            received: contentType,
          },
        } satisfies ZipCodeErrorResponse),
        {
          status: 415,
          headers: corsHeaders,
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const zipCode = body.zip?.toString() ?? null;

    // Validate zip code presence
    if (!zipCode) {
      return new Response(
        JSON.stringify({
          error: 'Missing zip code',
          details: { method: request.method },
        } satisfies ZipCodeErrorResponse),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate zip code format
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid zip code format',
          details: { providedZip: zipCode },
        } satisfies ZipCodeErrorResponse),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Extract the 5-digit ZIP code if a 9-digit ZIP was provided
    const fiveDigitZip = parseInt(zipCode.slice(0, 5));

    // First, try to find the ZIP code in our database
    const { data: centers, error: dbError } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('postal_code', fiveDigitZip)
      .limit(1);

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({
          error: 'Database error',
          details: { message: dbError.message },
        } satisfies ZipCodeErrorResponse),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // If we found the ZIP code in our database, use that data
    if (centers && centers.length > 0) {
      const center = centers[0];
      return new Response(
        JSON.stringify({
          city: center.city,
          state: center.state,
          coordinates: {
            lat: center.latitude,
            lng: center.longitude,
          },
        } satisfies ZipCodeResponse),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // If not found in database, use Nominatim's geocoding service as fallback
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${fiveDigitZip}&country=USA&format=json&addressdetails=1&limit=1`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'E-Waste-Directory/1.0',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: 'Zip code lookup service error',
          details: {
            status: response.status,
            statusText: response.statusText,
          },
        } satisfies ZipCodeErrorResponse),
        {
          status: 502,
          headers: corsHeaders,
        }
      );
    }

    const data = await response.json();

    if (!data.length) {
      return new Response(
        JSON.stringify({
          error: 'Location not found',
          details: { zipCode },
        } satisfies ZipCodeErrorResponse),
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    const location = data[0];
    const address = location.address;

    // Try to get the city name from various address fields
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.suburb;
    const state = address.state;

    if (!city || !state) {
      return new Response(
        JSON.stringify({
          error: 'Incomplete location data',
          details: { address },
        } satisfies ZipCodeErrorResponse),
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    // Store the geocoded result in our database for future use
    const { error: insertError } = await supabase
      .from('recycling_centers')
      .insert({
        postal_code: fiveDigitZip,
        city,
        state,
        latitude: parseFloat(location.lat),
        longitude: parseFloat(location.lon),
        name: `${city} Area Recycling`, // Generic name for geocoded entries
        description: 'Location data from geocoding service',
      });

    if (insertError) {
      console.error('Error storing geocoded data:', insertError);
      // Continue anyway since we have the data to return
    }

    return new Response(
      JSON.stringify({
        city,
        state,
        coordinates: {
          lat: parseFloat(location.lat),
          lng: parseFloat(location.lon),
        },
      } satisfies ZipCodeResponse),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('Zip code lookup error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
      } satisfies ZipCodeErrorResponse),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
};

export const POST = handler;
export default handler;
