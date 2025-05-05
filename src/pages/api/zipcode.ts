import type { APIRoute } from 'astro';

export const prerender = false;

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
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const config = {
  runtime: 'edge',
};

const handler: APIRoute = async ({ request, url }): Promise<Response> => {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    let zipCode: string | null = null;

    // Handle both GET and POST requests
    if (request.method === 'GET') {
      // Use the URL object passed by Astro
      zipCode = url.searchParams.get('zip');
      console.log('GET request - zip code from URL:', zipCode);
    } else if (request.method === 'POST') {
      const body = await request.json();
      zipCode = body.zip?.toString() ?? null;
      console.log('POST request - zip code from body:', zipCode);
    } else {
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

    // Handle missing zip code
    if (!zipCode) {
      console.error('Missing zip code parameter');
      return new Response(
        JSON.stringify({
          error: 'Missing zip code',
          details: {
            method: request.method,
            url: url.toString(),
            params: Object.fromEntries(url.searchParams),
          },
        } satisfies ZipCodeErrorResponse),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate zip code format
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      console.error('Invalid zip code format:', zipCode);
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
    const fiveDigitZip = zipCode.slice(0, 5);

    // Use Nominatim's geocoding service (free, no API key required)
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${fiveDigitZip}&country=USA&format=json&addressdetails=1&limit=1`;

    console.log('Fetching location data for ZIP:', fiveDigitZip);
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'E-Waste-Directory/1.0',
      },
    });

    if (!response.ok) {
      console.error(
        'Nominatim API error:',
        response.status,
        response.statusText
      );
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
    console.log('Nominatim API response:', JSON.stringify(data, null, 2));

    if (!data.length) {
      console.error('No location data found in Nominatim API response');
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
      console.error('Incomplete location data:', address);
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

    const zipCodeResult: ZipCodeResponse = {
      city,
      state,
      coordinates: {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lon),
      },
    };

    console.log('Returning location data:', zipCodeResult);
    return new Response(JSON.stringify(zipCodeResult), {
      status: 200,
      headers: corsHeaders,
    });
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

// Export both POST and post to handle case sensitivity
export const POST = handler;
export const post = handler;

// Export both GET and get to handle case sensitivity
export const GET = handler;
export const get = handler;

// Also export as default
export default handler;
