import type { APIRoute } from 'astro';

export const prerender = false;

// Explicitly mark this as an edge function for Vercel
export const config = {
  runtime: 'edge',
};

// CORS headers for the API response
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

// Define a type for our zip code data
interface ZipCodeData {
  city: string;
  state: string;
  coordinates: { lat: number; lng: number };
  source: string;
}

// Special case handlers for known problematic ZIP codes
const specialZipCodes: Record<string, ZipCodeData> = {
  // NYC ZIP codes
  '10001': {
    city: 'New York',
    state: 'new-york',
    coordinates: { lat: 40.7128, lng: -74.006 },
    source: 'hardcoded',
  },
  '10002': {
    city: 'New York',
    state: 'new-york',
    coordinates: { lat: 40.7128, lng: -74.006 },
    source: 'hardcoded',
  },
  // Beverly Hills
  '90210': {
    city: 'Beverly Hills',
    state: 'california',
    coordinates: { lat: 34.0736, lng: -118.4004 },
    source: 'hardcoded',
  },
  // Indianapolis
  '46268': {
    city: 'Indianapolis',
    state: 'indiana',
    coordinates: { lat: 39.9064, lng: -86.2403 },
    source: 'hardcoded',
  },
  // Chicago
  '60007': {
    city: 'Chicago',
    state: 'illinois',
    coordinates: { lat: 41.8781, lng: -87.6298 },
    source: 'hardcoded',
  },
  // Additional common ZIP codes
  '02108': {
    city: 'Boston',
    state: 'Massachusetts',
    coordinates: { lat: 42.3601, lng: -71.0589 },
    source: 'hardcoded',
  },
  '33131': {
    city: 'Miami',
    state: 'Florida',
    coordinates: { lat: 25.7617, lng: -80.1918 },
    source: 'hardcoded',
  },
  '75201': {
    city: 'Dallas',
    state: 'Texas',
    coordinates: { lat: 32.7767, lng: -96.797 },
    source: 'hardcoded',
  },
  '77002': {
    city: 'Houston',
    state: 'Texas',
    coordinates: { lat: 29.7604, lng: -95.3698 },
    source: 'hardcoded',
  },
  '94103': {
    city: 'San Francisco',
    state: 'California',
    coordinates: { lat: 37.7749, lng: -122.4194 },
    source: 'hardcoded',
  },
  '98101': {
    city: 'Seattle',
    state: 'Washington',
    coordinates: { lat: 47.6062, lng: -122.3321 },
    source: 'hardcoded',
  },
  '20001': {
    city: 'Washington',
    state: 'District of Columbia',
    coordinates: { lat: 38.9072, lng: -77.0369 },
    source: 'hardcoded',
  },
  '80202': {
    city: 'Denver',
    state: 'Colorado',
    coordinates: { lat: 39.7392, lng: -104.9903 },
    source: 'hardcoded',
  },
  '85001': {
    city: 'Phoenix',
    state: 'Arizona',
    coordinates: { lat: 33.4484, lng: -112.074 },
    source: 'hardcoded',
  },
  '30301': {
    city: 'Atlanta',
    state: 'Georgia',
    coordinates: { lat: 33.749, lng: -84.388 },
    source: 'hardcoded',
  },
  '19019': {
    city: 'Philadelphia',
    state: 'Pennsylvania',
    coordinates: { lat: 39.9526, lng: -75.1652 },
    source: 'hardcoded',
  },
  '48201': {
    city: 'Detroit',
    state: 'Michigan',
    coordinates: { lat: 42.3314, lng: -83.0458 },
    source: 'hardcoded',
  },
};

// Mapping of ZIP code prefixes to nearest major cities
// First 3 digits of ZIP can identify general region
const zipPrefixToCity: Record<string, { city: string; state: string }> = {
  // Northeast
  '100': { city: 'New York', state: 'new-york' }, // NYC
  '104': { city: 'Bronx', state: 'new-york' },
  '112': { city: 'Brooklyn', state: 'new-york' },
  '190': { city: 'Philadelphia', state: 'pennsylvania' },
  '021': { city: 'Boston', state: 'massachusetts' },

  // Midwest
  '606': { city: 'Chicago', state: 'illinois' },
  '482': { city: 'Detroit', state: 'michigan' },
  '462': { city: 'Indianapolis', state: 'indiana' },
  '631': { city: 'Saint Louis', state: 'missouri' },
  '441': { city: 'Cleveland', state: 'ohio' },

  // South
  '770': { city: 'Atlanta', state: 'georgia' },
  '752': { city: 'Dallas', state: 'texas' },
  '330': { city: 'Miami', state: 'florida' },
  '370': { city: 'Nashville', state: 'tennessee' },
  '700': { city: 'New Orleans', state: 'louisiana' },

  // West
  '900': { city: 'Los Angeles', state: 'california' },
  '941': { city: 'San Francisco', state: 'california' },
  '980': { city: 'Seattle', state: 'washington' },
  '970': { city: 'Portland', state: 'oregon' },
  '891': { city: 'Las Vegas', state: 'nevada' },
  '850': { city: 'Phoenix', state: 'arizona' },
  '801': { city: 'Denver', state: 'colorado' },
};

export const GET = (async ({ request }) => {
  // Support for OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get the ZIP code from the URL
    const url = new URL(request.url);
    const zipCode = url.searchParams.get('zip');
    console.log(`Processing zipcode API request with params: ${url.search}`);

    if (!zipCode) {
      console.log('No ZIP code provided');
      return new Response(
        JSON.stringify({
          error: 'Zip code is required',
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Ensure the ZIP is a 5-digit string
    const fiveDigitZip = zipCode.toString().padStart(5, '0').substring(0, 5);
    console.log(`Processing ZIP code: ${fiveDigitZip}`);

    // Check if this is one of our hardcoded special cases
    if (specialZipCodes[fiveDigitZip]) {
      console.log(`Found hardcoded data for ZIP ${fiveDigitZip}`);
      return new Response(JSON.stringify(specialZipCodes[fiveDigitZip]), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Find the closest city based on ZIP prefix
    let closestCity = null;
    if (fiveDigitZip && fiveDigitZip.length >= 3) {
      const prefix = fiveDigitZip.substring(0, 3);
      closestCity = zipPrefixToCity[prefix] || null;
      console.log(
        `Looking for prefix ${prefix}, found match: ${!!closestCity}`
      );

      // If we didn't find a match with 3 digits, try with 2
      if (!closestCity && fiveDigitZip.length >= 2) {
        const shortPrefix = fiveDigitZip.substring(0, 2);
        console.log(`Trying shorter prefix ${shortPrefix}`);
        // Look for a matching prefix that starts with these digits
        for (const [key, value] of Object.entries(zipPrefixToCity)) {
          if (key.startsWith(shortPrefix)) {
            closestCity = value;
            console.log(`Found match with key ${key}`);
            break;
          }
        }
      }
    }

    // If we still don't have a closest city, default to a major city in the center of the US
    if (!closestCity) {
      console.log(`No city match found, using default`);
      closestCity = { city: 'Chicago', state: 'Illinois' };
    } else {
      console.log(
        `Using closest city: ${closestCity.city}, ${closestCity.state}`
      );
    }

    const response = {
      city: 'Unknown Location',
      state: 'State Unknown',
      coordinates: { lat: 40.0, lng: -98.0 }, // Center of USA
      source: 'fallback',
      closestCity: closestCity, // Include the closest city in the response
    };

    console.log(`Returning response for ZIP ${fiveDigitZip}:`, response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error(`ZIP API error:`, error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process ZIP code',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}) satisfies APIRoute;

// Also export a POST handler for backward compatibility
export const POST = GET;
