import type { APIRoute } from 'astro';

// Disable prerendering for this endpoint
export const prerender = false;

export interface GeocodeResponse {
  city: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface GeocodeErrorResponse {
  error: string;
  details?: Record<string, any>;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const handler: APIRoute = async ({ url, request }): Promise<Response> => {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get the raw URL and parse it directly
    const rawUrl = request.url;
    console.log('Raw request URL:', rawUrl);

    // Parse URL parameters directly from the raw URL
    const searchParams = new URL(rawUrl).searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    console.log('Parsed coordinates from raw URL:', { lat, lng });

    // Handle missing coordinates
    if (!lat || !lng) {
      return new Response(
        JSON.stringify({
          error: 'Missing coordinates',
          details: {
            providedLat: lat,
            providedLng: lng,
            rawUrl,
          },
        } satisfies GeocodeErrorResponse),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Parse coordinates
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    // Validate parsed coordinates
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid coordinates format',
          details: {
            providedLat: lat,
            providedLng: lng,
            parsedLat,
            parsedLng,
          },
        } satisfies GeocodeErrorResponse),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate coordinate ranges
    if (
      parsedLat < -90 ||
      parsedLat > 90 ||
      parsedLng < -180 ||
      parsedLng > 180
    ) {
      return new Response(
        JSON.stringify({
          error: 'Coordinates out of valid range',
          details: { parsedLat, parsedLng },
        } satisfies GeocodeErrorResponse),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Use OpenStreetMap's Nominatim service for geocoding
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parsedLat.toFixed(
      6
    )}&lon=${parsedLng.toFixed(6)}&zoom=18&addressdetails=1`;

    console.log('Calling Nominatim:', nominatimUrl);

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Astro-Geocoding-Service/1.0',
      },
    });

    if (!response.ok) {
      console.error('Nominatim error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({
          error: 'Geocoding service error',
          details: {
            status: response.status,
            statusText: response.statusText,
          },
        } satisfies GeocodeErrorResponse),
        {
          status: 502,
          headers: corsHeaders,
        }
      );
    }

    const data = await response.json();
    console.log('Nominatim response:', data);

    if (!data.address) {
      return new Response(
        JSON.stringify({
          error: 'No address found',
          details: data,
        } satisfies GeocodeErrorResponse),
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    const city = data.address.city || data.address.town || data.address.village;
    const state = data.address.state;

    if (!city || !state) {
      return new Response(
        JSON.stringify({
          error: 'Location not found',
          details: data.address,
        } satisfies GeocodeErrorResponse),
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    const geocodeResult: GeocodeResponse = {
      city,
      state,
      coordinates: { lat: parsedLat, lng: parsedLng },
    };

    return new Response(JSON.stringify(geocodeResult), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
      } satisfies GeocodeErrorResponse),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
};

// Export both GET and get to handle case sensitivity
export const GET = handler;
export const get = handler;

// Also export as default
export default handler;
