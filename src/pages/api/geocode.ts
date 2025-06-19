import type { APIRoute } from 'astro';

// Server-side endpoint for geocoding, disabled for static generation
// export const prerender = false;

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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    let lat: string | null = null;
    let lng: string | null = null;

    // Handle both GET and POST requests
    if (request.method === 'GET') {
      const url = new URL(request.url);
      lat = url.searchParams.get('lat');
      lng = url.searchParams.get('lng');
    } else if (request.method === 'POST') {
      const body = await request.json();
      lat = body.lat?.toString() ?? null;
      lng = body.lng?.toString() ?? null;
    } else {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
          details: { method: request.method },
        } satisfies GeocodeErrorResponse),
        {
          status: 405,
          headers: corsHeaders,
        }
      );
    }

    // Handle missing coordinates
    if (lat == null || lng == null) {
      return new Response(
        JSON.stringify({
          error: 'Missing coordinates',
          details: {
            method: request.method,
            providedLat: lat,
            providedLng: lng,
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

// Export both POST and post to handle case sensitivity
export const POST = handler;
export const post = handler;

// Export both GET and get to handle case sensitivity
export const GET = handler;
export const get = handler;

// Also export as default
export default handler;
