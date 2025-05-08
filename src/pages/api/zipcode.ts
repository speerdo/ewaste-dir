import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { getAllCityStatePairs } from '../../lib/cityData';

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

// Define a type for location data
interface LocationData {
  city: string;
  state: string;
  coordinates?: { lat: number; lng: number };
  source: string;
  url?: string;
}

// Interface for ZIP code responses
interface ZipCodeResponse {
  city: string;
  state: string;
  coordinates?: { lat: number; lng: number };
  source: string;
  url?: string;
}

// Interface for error responses
interface ZipCodeErrorResponse {
  error: string;
  message?: string;
  fallback?: ZipCodeResponse;
}

/**
 * Get coordinates for a ZIP code using a geocoding service
 */
async function getCoordinatesFromZipCode(
  zipCode: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    console.log(`Getting coordinates for ZIP code ${zipCode}`);

    // First check if we have coordinates in our database
    const { data, error } = await supabase
      .from('recycling_centers')
      .select('latitude, longitude')
      .eq('postal_code', parseInt(zipCode, 10))
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(1);

    if (data && data.length > 0 && data[0].latitude && data[0].longitude) {
      return {
        lat: parseFloat(data[0].latitude),
        lng: parseFloat(data[0].longitude),
      };
    }

    // Use Census.gov Geocoding API which is free and doesn't require a key
    const url = `https://geocoding.geo.census.gov/geocoder/locations/address?zip=${zipCode}&benchmark=Public_AR_Current&format=json`;

    const response = await fetch(url);
    const result = await response.json();

    if (
      result.result?.addressMatches?.length > 0 &&
      result.result.addressMatches[0].coordinates
    ) {
      const coords = result.result.addressMatches[0].coordinates;
      return {
        lat: coords.y,
        lng: coords.x,
      };
    }

    // Fallback to Open Street Map's Nominatim service
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=USA&format=json`;

    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Astro-Geocoding-Service/1.0',
      },
    });

    const nominatimData = await nominatimResponse.json();

    if (nominatimData && nominatimData.length > 0) {
      return {
        lat: parseFloat(nominatimData[0].lat),
        lng: parseFloat(nominatimData[0].lon),
      };
    }

    console.log(`No coordinates found for ZIP ${zipCode}`);
    return null;
  } catch (error) {
    console.error(`Error getting coordinates for ZIP ${zipCode}:`, error);
    return null;
  }
}

/**
 * Find the closest city based on finding the nearest recycling center
 */
async function findClosestRecyclingCenter(coordinates: {
  lat: number;
  lng: number;
}): Promise<LocationData | null> {
  try {
    console.log(
      `Finding closest recycling center for coordinates: ${coordinates.lat}, ${coordinates.lng}`
    );

    // Optimize the query by adding limits
    const { data: centers, error } = await supabase
      .from('recycling_centers')
      .select('id, city, state, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1000); // Limit to 1000 centers to avoid timing out

    if (error) {
      console.error('Error querying recycling centers:', error);
      return null;
    }

    if (!centers || centers.length === 0) {
      console.log('No recycling centers with coordinates found');
      return null;
    }

    console.log(`Found ${centers.length} recycling centers with coordinates`);

    // Find the closest center
    let closestCenter = null;
    let closestDistance = Number.MAX_VALUE;

    for (const center of centers) {
      if (!center.latitude || !center.longitude) continue;

      const centerCoords = {
        lat: parseFloat(center.latitude),
        lng: parseFloat(center.longitude),
      };

      // Calculate distance between the two points
      const distance = calculateDistance(coordinates, centerCoords);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestCenter = center;
      }
    }

    if (closestCenter) {
      console.log(
        `Found closest recycling center in ${closestCenter.city}, ${
          closestCenter.state
        } (${closestDistance.toFixed(2)}km away)`
      );

      // Format the state to match URL convention
      const formattedState = closestCenter.state
        .toLowerCase()
        .replace(/\s+/g, '-');
      const formattedCity = closestCenter.city
        .toLowerCase()
        .replace(/\s+/g, '-');

      // Create URL for this city
      const url = `/states/${formattedState}/${formattedCity}`;

      return {
        city: closestCenter.city,
        state: closestCenter.state,
        coordinates: {
          lat: parseFloat(closestCenter.latitude),
          lng: parseFloat(closestCenter.longitude),
        },
        source: 'closest-recycling-center',
        url,
      };
    }

    return null;
  } catch (error) {
    console.error('Error finding closest recycling center:', error);
    return null;
  }
}

/**
 * Process the ZIP code with a timeout to avoid serverless function timeouts
 */
async function processZipCodeWithTimeout(
  zipCode: string
): Promise<LocationData | null> {
  // Set a timeout for the whole operation to avoid Vercel timeouts
  const timeout = 4000; // 4 seconds max
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`Processing timed out after ${timeout}ms, using fallback`);
      resolve(null);
    }, timeout);
  });

  try {
    const result = await Promise.race([
      processZipCode(zipCode),
      timeoutPromise,
    ]);

    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    console.error(`Error in timeout wrapper:`, error);
    return null;
  }
}

/**
 * Main function to process a zip code
 */
async function processZipCode(zipCode: string): Promise<LocationData | null> {
  try {
    // STEP 1: First check our database for the exact ZIP code with city/state
    // Use a short timeout for this first query
    const zipQueryPromise = supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('postal_code', parseInt(zipCode, 10))
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1);

    const zipTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Zip query timeout')), 1000);
    });

    try {
      console.log(`Checking database for ZIP code ${zipCode}`);
      const { data: zipData, error: zipError } = (await Promise.race([
        zipQueryPromise,
        zipTimeout,
      ])) as any;

      if (zipError) {
        console.error(`Error querying database for ZIP ${zipCode}:`, zipError);
      }

      // If we found a match in our database, use it directly
      if (
        zipData &&
        zipData.length > 0 &&
        zipData[0].city &&
        zipData[0].state
      ) {
        const center = zipData[0];
        console.log(
          `Found direct match in database: ${center.city}, ${center.state}`
        );

        // Format the state to match URL convention
        const formattedState = center.state.toLowerCase().replace(/\s+/g, '-');
        const formattedCity = center.city.toLowerCase().replace(/\s+/g, '-');

        // Create URL for this city
        const url = `/states/${formattedState}/${formattedCity}`;

        return {
          city: center.city,
          state: center.state,
          coordinates:
            center.latitude && center.longitude
              ? {
                  lat: parseFloat(center.latitude),
                  lng: parseFloat(center.longitude),
                }
              : undefined,
          source: 'database-direct-match',
          url,
        };
      }
    } catch (error) {
      console.log(`ZIP query timed out or failed, continuing with geocoding`);
    }

    // STEP 2: Get coordinates for the ZIP code
    const coordinates = await getCoordinatesFromZipCode(zipCode);

    if (!coordinates) {
      console.log(`Could not get coordinates for ZIP ${zipCode}`);
      return getFallbackCity('zip-coordinate-error');
    }

    // STEP 3: Find the closest recycling center in our database
    try {
      const closestCenterTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Center query timeout')), 2000);
      });

      const closestCenter = (await Promise.race([
        findClosestRecyclingCenter(coordinates),
        closestCenterTimeout,
      ])) as any;

      if (closestCenter) {
        return closestCenter;
      }
    } catch (error) {
      console.log(`Recycling center query timed out, trying fallback`);
    }

    return getFallbackCity('no-match-found');
  } catch (error) {
    console.error(`Error processing ZIP ${zipCode}:`, error);
    return getFallbackCity('error-exception');
  }
}

/**
 * Get a fallback city when all else fails - always from the database
 */
async function getFallbackCity(source: string): Promise<LocationData> {
  // Try to get a popular city with most recycling centers from the database
  try {
    // Query to find cities with the most recycling centers - without using group
    const { data: centers } = await supabase
      .from('recycling_centers')
      .select('city, state')
      .not('city', 'is', null)
      .not('state', 'is', null);

    if (centers && centers.length > 0) {
      // Count occurrences of each city/state pair
      const cityCounts = centers.reduce((acc, center) => {
        const key = `${center.city}-${center.state}`;
        acc[key] = acc[key] || {
          city: center.city,
          state: center.state,
          count: 0,
        };
        acc[key].count++;
        return acc;
      }, {} as Record<string, { city: string; state: string; count: number }>);

      // Find the most popular city
      const popularCities = Object.values(cityCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      if (popularCities.length > 0) {
        const center = popularCities[0];

        // Now get a specific recycling center for this city/state to get coordinates
        const { data: centerDetails } = await supabase
          .from('recycling_centers')
          .select('latitude, longitude')
          .eq('city', center.city)
          .eq('state', center.state)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .limit(1);

        // Format the state to match URL convention
        const formattedState = center.state.toLowerCase().replace(/\s+/g, '-');
        const formattedCity = center.city.toLowerCase().replace(/\s+/g, '-');

        // Create URL for this city
        const url = `/states/${formattedState}/${formattedCity}`;

        let coordinates = undefined;
        if (centerDetails && centerDetails.length > 0) {
          coordinates = {
            lat: parseFloat(centerDetails[0].latitude),
            lng: parseFloat(centerDetails[0].longitude),
          };
        }

        return {
          city: center.city,
          state: center.state,
          coordinates,
          source: `popular-city-fallback-${source}`,
          url,
        };
      }
    }
  } catch (error) {
    console.error('Failed to get popular city fallback:', error);
  }

  // Second fallback: get any city from the database
  try {
    const { data: centers } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(5);

    if (centers && centers.length > 0) {
      const center = centers[0];

      // Format the state to match URL convention
      const formattedState = center.state.toLowerCase().replace(/\s+/g, '-');
      const formattedCity = center.city.toLowerCase().replace(/\s+/g, '-');

      // Create URL for this city
      const url = `/states/${formattedState}/${formattedCity}`;

      return {
        city: center.city,
        state: center.state,
        coordinates:
          center.latitude && center.longitude
            ? {
                lat: parseFloat(center.latitude),
                lng: parseFloat(center.longitude),
              }
            : undefined,
        source: `database-fallback-${source}`,
        url,
      };
    }
  } catch (error) {
    console.error('Failed to get database fallback city:', error);
  }

  // Third fallback - get first city from cityStatePairs
  try {
    const allCities = await getAllCityStatePairs();
    if (allCities && allCities.length > 0) {
      const city = allCities[0];
      return {
        city: city.city,
        state: city.state,
        source: `city-pairs-fallback-${source}`,
        url: city.url,
      };
    }
  } catch (error) {
    console.error('Failed to get city pairs fallback:', error);
  }

  // This should basically never happen, but just in case everything fails
  // Query the database for any state and construct a fallback
  try {
    const { data: states } = await supabase
      .from('states')
      .select('name')
      .limit(1);

    if (states && states.length > 0) {
      return {
        city: 'Unknown',
        state: states[0].name,
        source: `states-table-fallback-${source}`,
        url: `/states/${states[0].name.toLowerCase().replace(/\s+/g, '-')}`,
      };
    }
  } catch (error) {
    console.error('Failed to get states fallback:', error);
  }

  // Absolute last resort with no database dependency
  return {
    city: 'Unknown',
    state: 'unknown',
    source: `complete-failure-${source}`,
    url: '/',
  };
}

// Helper function to calculate distance between two coordinate points
function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLon = ((point2.lng - point1.lng) * Math.PI) / 180;
  const lat1 = (point1.lat * Math.PI) / 180;
  const lat2 = (point2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to ensure response is properly formatted
function formatResponse(data: any): ZipCodeResponse {
  // Ensure we have city and state at a minimum
  if (!data || !data.city || !data.state) {
    console.log('Response missing city/state, adding fallback values:', data);
    return {
      city: (data && data.city) || 'Unknown',
      state: (data && data.state) || 'unknown',
      source: (data && data.source) || 'formatted-fallback',
      url: (data && data.url) || '/',
    };
  }

  // Ensure the response has the correct structure
  return {
    city: data.city,
    state: data.state,
    source: data.source || 'unknown',
    url:
      data.url ||
      `/states/${data.state.toLowerCase().replace(/\s+/g, '-')}/${data.city
        .toLowerCase()
        .replace(/\s+/g, '-')}`,
    coordinates: data.coordinates,
  };
}

// Make sure the response is properly formatted for the Vercel Edge Runtime
function createResponse(data: any, status: number = 200): Response {
  // Ensure proper CORS headers and content type
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

export const GET = (async ({ request }) => {
  // Support for OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Print request details for debugging
    const url = new URL(request.url);
    console.log(`Processing zipcode API request with params: ${url.search}`);

    // First try the standard .get() method
    let zipCode = url.searchParams.get('zip');

    // If that fails, try accessing the raw search params
    if (!zipCode && url.search) {
      console.log(`Standard param extraction failed, trying manual extraction`);
      // Try to extract zip from the raw query string
      const match = /[?&]zip=([^&]+)/.exec(url.search);
      if (match && match[1]) {
        zipCode = match[1];
        console.log(`Manually extracted ZIP: ${zipCode}`);
      }
    }

    console.log(`Final ZIP parameter: ${zipCode || 'not found'}`);

    if (!zipCode || zipCode.trim() === '') {
      console.log('No ZIP code provided');
      return createResponse({
        error: 'Zip code is required',
        fallback: formatResponse(await getFallbackCity('no-zip-provided')),
      });
    }

    // Ensure the ZIP is a 5-digit string
    const fiveDigitZip = zipCode.toString().padStart(5, '0').substring(0, 5);
    console.log(`Processing ZIP code: ${fiveDigitZip}`);

    // Process the ZIP code with a timeout to avoid serverless function timeouts
    const locationData = await processZipCodeWithTimeout(fiveDigitZip);

    if (locationData) {
      return createResponse(formatResponse(locationData));
    }

    // If all else fails, return a fallback
    return createResponse(
      formatResponse(await getFallbackCity('complete-fallback'))
    );
  } catch (error) {
    console.error(`ZIP API error:`, error);

    // Return fallback from database
    return createResponse({
      error: 'Failed to process ZIP code',
      message: error instanceof Error ? error.message : 'Unknown error',
      fallback: formatResponse(await getFallbackCity('error-fallback')),
    } as ZipCodeErrorResponse);
  }
}) satisfies APIRoute;

// Also export a POST handler for backward compatibility
export const POST = GET;
