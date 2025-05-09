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
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Cache-Control':
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export const config = {
  runtime: 'edge',
};

const handler: APIRoute = async ({ request }): Promise<Response> => {
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
      // Log the raw request for debugging
      // console.log('GET Request object:', {
      //   url: request.url,
      //   method: request.method,
      //   headers: Object.fromEntries(request.headers),
      // });

      // Try multiple methods to get the zip parameter
      try {
        // Method 1: Try using URL API
        const url = new URL(request.url);
        // console.log('Method 1 - URL search:', url.search);
        zipCode = url.searchParams.get('zip');

        // Method 2: If that fails, try getting raw query string
        if (!zipCode) {
          const rawQuery = request.url.split('?')[1];
          // console.log('Method 2 - Raw query:', rawQuery);
          if (rawQuery) {
            const params = new URLSearchParams(rawQuery);
            zipCode = params.get('zip');
          }
        }

        // Method 3: If that fails, try regex
        if (!zipCode) {
          // console.log('Method 3 - Using regex');
          const match = request.url.match(/[?&]zip=([^&]+)/);
          zipCode = match ? decodeURIComponent(match[1]) : null;
        }

        // console.log('Final extracted zip code:', zipCode);
      } catch (error) {
        console.error('Error extracting zip code:', error);
      }
    } else if (request.method === 'POST') {
      try {
        // console.log('Processing POST request');
        const contentType = request.headers.get('content-type');
        // console.log('Content-Type:', contentType);

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

        const body = await request.json();
        // Remove timestamp if present (used for cache busting)
        const { _timestamp, ...actualBody } = body;
        console.log(
          `Processing zipcode request at ${new Date().toISOString()}`,
          {
            zipCode: actualBody.zip,
            timestamp: _timestamp,
          }
        );
        zipCode = actualBody.zip?.toString() ?? null;
        // console.log('POST request - zip code from body:', zipCode);
      } catch (error) {
        console.error('Error parsing POST request body:', error);
        return new Response(
          JSON.stringify({
            error: 'Invalid request body',
            details: {
              message: error instanceof Error ? error.message : String(error),
            },
          } satisfies ZipCodeErrorResponse),
          {
            status: 400,
            headers: corsHeaders,
          }
        );
      }
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
            url: request.url,
            headers: Object.fromEntries(request.headers),
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

    // console.log('Fetching location data for ZIP:', fiveDigitZip);
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
    // console.log('Nominatim API response:', JSON.stringify(data, null, 2));

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

    // console.log('Returning location data:', zipCodeResult);
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
