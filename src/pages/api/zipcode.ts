import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const prerender = false;

export interface ZipCodeResponse {
  city: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  source?: string;
}

export interface ZipCodeErrorResponse {
  error: string;
  details?: Record<string, any>;
}

// CORS headers for the API response
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

// Calculate distance between two coordinate points (in kilometers)
function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  const lat1 = toRad(point1.lat);
  const lat2 = toRad(point2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

// Special case handlers for known problematic ZIP codes
const specialZipCodes: Record<string, ZipCodeResponse> = {
  // NYC ZIP codes
  '10001': {
    city: 'New York',
    state: 'New York',
    coordinates: { lat: 40.7128, lng: -74.006 },
    source: 'hardcoded-NYC',
  },
  '10002': {
    city: 'New York',
    state: 'New York',
    coordinates: { lat: 40.7128, lng: -74.006 },
    source: 'hardcoded-NYC',
  },
  // Beverly Hills
  '90210': {
    city: 'Beverly Hills',
    state: 'California',
    coordinates: { lat: 34.0736, lng: -118.4004 },
    source: 'hardcoded-beverly',
  },
};

// Handler for GET requests (required for Vercel)
export const GET: APIRoute = async ({ request, url }) => {
  // Support for OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Get the ZIP code from the query parameters
  const zipCode = url.searchParams.get('zip');

  if (!zipCode) {
    return new Response(JSON.stringify({ error: 'Zip code is required' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Ensure the ZIP is a 5-digit string
  const fiveDigitZip = zipCode.toString().padStart(5, '0').substring(0, 5);
  console.log(`Processing ZIP code: ${fiveDigitZip}`);

  try {
    // 1. Check if this is a known special case ZIP code
    if (specialZipCodes[fiveDigitZip]) {
      console.log(`Using special case data for ${fiveDigitZip}`);
      return new Response(JSON.stringify(specialZipCodes[fiveDigitZip]), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 2. Check NYC ZIP code patterns (common prefix patterns)
    if (
      fiveDigitZip.startsWith('100') ||
      fiveDigitZip.startsWith('101') ||
      fiveDigitZip.startsWith('102')
    ) {
      console.log(`Detected NYC ZIP pattern: ${fiveDigitZip}`);
      return new Response(JSON.stringify(specialZipCodes['10001']), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 3. Check our database for recycling centers with this ZIP code
    const { data: recyclingCenters, error: dbError } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('postal_code', fiveDigitZip)
      .limit(1);

    if (recyclingCenters && recyclingCenters.length > 0) {
      console.log(`Found matching recycling center for ${fiveDigitZip}`);
      const center = recyclingCenters[0];
      return new Response(
        JSON.stringify({
          city: center.city,
          state: center.state,
          coordinates: {
            lat: center.latitude,
            lng: center.longitude,
          },
          source: 'database',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 4. Use external API (OpenStreetMap Nominatim)
    console.log(`No database match, trying Nominatim for ${fiveDigitZip}`);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${fiveDigitZip}&country=USA&format=json&addressdetails=1&limit=1`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'E-Waste-Directory/1.0',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(
        `External API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Handle case where the ZIP code is valid but not found
    if (!data || data.length === 0) {
      // Try an alternative API as final fallback (Maps.co)
      console.log(`No Nominatim results, trying Maps.co for ${fiveDigitZip}`);
      try {
        const mapscoUrl = `https://geocode.maps.co/search?postalcode=${fiveDigitZip}&country=USA`;
        const mapscoResponse = await fetch(mapscoUrl);

        if (mapscoResponse.ok) {
          const mapscoData = await mapscoResponse.json();

          if (mapscoData && mapscoData.length > 0) {
            const result = mapscoData[0];
            // Extract city and state from display_name
            const nameParts = result.display_name.split(', ');
            // Format is typically: "city, county, state zip, country"
            let city = nameParts[0] || '';
            let state = nameParts[nameParts.length - 3] || ''; // Usually state is third from end

            return new Response(
              JSON.stringify({
                city,
                state,
                coordinates: {
                  lat: parseFloat(result.lat),
                  lng: parseFloat(result.lon),
                },
                source: 'maps.co',
              }),
              { status: 200, headers: corsHeaders }
            );
          }
        }
      } catch (fallbackError) {
        console.error(`Fallback geocoding failed: ${fallbackError}`);
      }

      // If we got here, all lookups failed
      return new Response(
        JSON.stringify({
          error: `No location found for ZIP code ${fiveDigitZip}`,
          details: { zipCode: fiveDigitZip },
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Extract city and state from the API response
    const result = data[0];
    const address = result.address;

    let city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.municipality ||
      '';
    let state = address.state || '';

    // Handle New York City boroughs specifically
    const nycBoroughs = [
      'manhattan',
      'brooklyn',
      'queens',
      'bronx',
      'staten island',
    ];
    if (
      nycBoroughs.includes(city.toLowerCase()) &&
      state.toLowerCase() === 'new york'
    ) {
      city = 'New York';
    }

    return new Response(
      JSON.stringify({
        city,
        state,
        coordinates: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
        },
        source: 'nominatim',
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error(`Error processing ZIP code ${fiveDigitZip}:`, error);

    return new Response(
      JSON.stringify({
        error: `Failed to process ZIP code ${fiveDigitZip}`,
        details: { message: error.message },
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

// Handler for POST requests (for backward compatibility)
export const POST = GET;
