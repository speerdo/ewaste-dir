import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { getAllCityStatePairs } from '../../lib/cityData';

export const prerender = false;

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

// CORS headers for the API response
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, X-Requested-With, X-No-Cache, X-Zip-Code, X-Request-ID',
  'Cache-Control':
    'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
  'Edge-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-cache',
  'Surrogate-Key': 'zipcode-api',
  Vary: '*',
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
  requestedZip?: string;
  requestId?: string;
  clientRequestId?: string;
  timestamp?: string;
  unixTime?: number;
  parsedBody?: any;
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

    // First check if we have coordinates in our database - try both integer and string forms
    // First, try as integer
    const { data: intData, error: intError } = await supabase
      .from('recycling_centers')
      .select('latitude, longitude')
      .eq('postal_code', parseInt(zipCode, 10))
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(1);

    // If no results found as integer, try as string
    const { data: strData, error: strError } = !intData?.length
      ? await supabase
          .from('recycling_centers')
          .select('latitude, longitude')
          .eq('postal_code', zipCode)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .limit(1)
      : { data: null, error: null };

    const data = intData?.length ? intData : strData;
    const error = intError || strError;

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

  // Add a unique timestamp to avoid any caching effects
  const timestamp = Date.now();
  console.log(`Processing ZIP ${zipCode} with timestamp ${timestamp}`);

  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`Processing timed out after ${timeout}ms, using fallback`);
      resolve(null);
    }, timeout);
  });

  try {
    console.log(`Starting zip code processing with timeout for ${zipCode}...`);
    const result = await Promise.race([
      processZipCode(zipCode, timestamp),
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
async function processZipCode(
  zipCode: string,
  timestamp: number = Date.now()
): Promise<LocationData | null> {
  try {
    // STEP 1: First check our database for the exact ZIP code with city/state
    // Use a short timeout for this first query - try both integer and string forms
    const intQueryPromise = supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('postal_code', parseInt(zipCode, 10))
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1);

    const strQueryPromise = supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('postal_code', zipCode)
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1);

    const zipTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Zip query timeout')), 1000);
    });

    try {
      console.log(
        `Checking database for ZIP code ${zipCode} (timestamp: ${timestamp})`
      );

      // Try integer version first with timeout
      const { data: intZipData, error: intZipError } = (await Promise.race([
        intQueryPromise,
        zipTimeout,
      ])) as any;

      // If integer version failed or returned no results, try string version
      let zipData = intZipData;
      let zipError = intZipError;

      if (!intZipData || intZipData.length === 0) {
        try {
          const { data: strZipData, error: strZipError } = (await Promise.race([
            strQueryPromise,
            zipTimeout,
          ])) as any;

          zipData = strZipData;
          zipError = strZipError;
        } catch (strErr) {
          console.log(`String ZIP query timed out or failed`);
        }
      }

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
          source: `database-direct-match-t${timestamp}`,
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
 * This function tries multiple sources to get a fallback city in priority order:
 * 1. Popular city with most recycling centers
 * 2. Any city from the database
 * 3. First city from cityStatePairs
 * 4. Any state from states table
 * 5. Generic fallback with no hardcoded data
 */
async function getFallbackCity(source: string): Promise<LocationData> {
  // Add timestamp to avoid any caching
  const timestamp = Date.now();
  console.log(
    `Getting fallback city (source: ${source}, timestamp: ${timestamp})`
  );

  // Try to get a popular city with most recycling centers from the database
  try {
    // Query to find cities with the most recycling centers
    const { data: centers, error } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1000);

    if (error) {
      console.error(`Error querying recycling centers for fallback:`, error);
    } else if (centers && centers.length > 0) {
      console.log(`Found ${centers.length} centers for fallback calculation`);

      // Count occurrences of each city/state pair
      const cityCounts = centers.reduce((acc, center) => {
        const key = `${center.city}-${center.state}`;
        acc[key] = acc[key] || {
          city: center.city,
          state: center.state,
          count: 0,
          latitude: center.latitude,
          longitude: center.longitude,
        };
        acc[key].count++;
        return acc;
      }, {} as Record<string, { city: string; state: string; count: number; latitude?: string; longitude?: string }>);

      // Find the most popular cities
      const popularCities = Object.values(cityCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      if (popularCities.length > 0) {
        // Select a city randomly from the top 5 to provide variety
        const randomIndex = Math.floor(
          Math.random() * Math.min(5, popularCities.length)
        );
        const center = popularCities[randomIndex];
        console.log(
          `Using popular city fallback: ${center.city}, ${center.state} (${center.count} recycling centers)`
        );

        // Format the state to match URL convention
        const formattedState = center.state.toLowerCase().replace(/\s+/g, '-');
        const formattedCity = center.city.toLowerCase().replace(/\s+/g, '-');

        // Create URL for this city
        const url = `/states/${formattedState}/${formattedCity}`;

        let coordinates = undefined;
        if (center.latitude && center.longitude) {
          coordinates = {
            lat: parseFloat(center.latitude),
            lng: parseFloat(center.longitude),
          };
        }

        return {
          city: center.city,
          state: center.state,
          coordinates,
          source: `popular-city-fallback-${source}-t${timestamp}`,
          url,
        };
      }
    }
  } catch (error) {
    console.error('Failed to get popular city fallback:', error);
  }

  // Second fallback: get any city from the database with a random selection
  try {
    console.log(`Trying random city fallback`);
    const { data: centers, error } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(20); // Get more options for randomization

    if (error) {
      console.error(
        `Error querying recycling centers for random fallback:`,
        error
      );
    } else if (centers && centers.length > 0) {
      // Select a random center
      const randomIndex = Math.floor(Math.random() * centers.length);
      const center = centers[randomIndex];
      console.log(
        `Using random city fallback: ${center.city}, ${center.state}`
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
        source: `random-city-fallback-${source}-t${timestamp}`,
        url,
      };
    }
  } catch (error) {
    console.error('Failed to get random city fallback:', error);
  }

  // Third fallback - get first city from cityStatePairs
  try {
    console.log(`Trying cityStatePairs fallback`);
    const allCities = await getAllCityStatePairs();
    if (allCities && allCities.length > 0) {
      // Get a random city from the list
      const randomIndex = Math.floor(
        Math.random() * Math.min(10, allCities.length)
      );
      const city = allCities[randomIndex];
      console.log(`Using city pairs fallback: ${city.city}, ${city.state}`);

      return {
        city: city.city,
        state: city.state,
        source: `city-pairs-fallback-${source}-t${timestamp}`,
        url: city.url,
      };
    }
  } catch (error) {
    console.error('Failed to get city pairs fallback:', error);
  }

  // Fourth fallback - Query the database for any state and construct a fallback
  try {
    console.log(`Trying states table fallback`);
    const { data: states, error } = await supabase
      .from('states')
      .select('name')
      .limit(10);

    if (error) {
      console.error(`Error querying states for fallback:`, error);
    } else if (states && states.length > 0) {
      // Get a random state
      const randomIndex = Math.floor(Math.random() * states.length);
      const state = states[randomIndex];
      console.log(`Using states table fallback: ${state.name}`);

      return {
        city: 'Unknown',
        state: state.name,
        source: `states-table-fallback-${source}-t${timestamp}`,
        url: `/states/${state.name.toLowerCase().replace(/\s+/g, '-')}`,
      };
    }
  } catch (error) {
    console.error('Failed to get states fallback:', error);
  }

  // Absolute last resort with no database dependency and no hardcoded city
  console.log(`Using generic fallback - all other methods failed`);
  return {
    city: 'Unknown',
    state: 'unknown',
    source: `complete-failure-${source}-t${timestamp}`,
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
function formatResponse(data: any, requestedZip?: string): ZipCodeResponse {
  // Ensure we have city and state at a minimum
  if (!data || !data.city || !data.state) {
    console.log('Response missing city/state, adding fallback values:', data);
    return {
      city: (data && data.city) || 'Unknown',
      state: (data && data.state) || 'unknown',
      source: (data && data.source) || 'formatted-fallback',
      url: data && data.url ? `${data.url}?_t=${Date.now()}` : '/',
      requestedZip: requestedZip,
    };
  }

  // Add a timestamp to the URL to make it unique for every request
  const uniqueUrl = data.url
    ? data.url.includes('?')
      ? `${data.url}&_t=${Date.now()}`
      : `${data.url}?_t=${Date.now()}`
    : `/states/${data.state.toLowerCase().replace(/\s+/g, '-')}/${data.city
        .toLowerCase()
        .replace(/\s+/g, '-')}?_t=${Date.now()}`;

  // Ensure the response has the correct structure
  return {
    city: data.city,
    state: data.state,
    source: data.source || 'unknown',
    url: uniqueUrl,
    coordinates: data.coordinates,
    requestedZip: requestedZip,
  };
}

// Make sure the response is properly formatted for the Vercel Edge Runtime
function createResponse(data: any, status: number = 200): Response {
  // Ensure we always include the timestamp and a cache-busting hash in the response
  if (typeof data === 'object' && data !== null) {
    data.timestamp = new Date().toISOString();
    data.unixTime = Date.now();
    data.cacheHash = Math.random().toString(36).substring(2, 15);
  }

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      // Double-down on cache prevention
      'Cache-Control':
        'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
      'Edge-Control': 'no-store',
      'X-Cache-Buster': Date.now().toString(),
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
    // Generate a unique ID for this request
    const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    console.log(`Processing zipcode API request ${requestId}: ${request.url}`);

    // Log headers for debugging
    const requestHeaders: Record<string, string> = {};
    for (const [key, value] of request.headers.entries()) {
      requestHeaders[key] = value;
    }
    console.log(`Request ${requestId} headers:`, requestHeaders);

    // Get the URL and parameters - more robust parsing
    let url: URL;
    try {
      url = new URL(request.url);
      console.log(`URL parsed ${requestId}: ${url.toString()}`);
      console.log(`URL pathname ${requestId}: ${url.pathname}`);
    } catch (error) {
      console.error(`Error parsing URL ${requestId}:`, error);
      return createResponse(
        {
          error: 'Invalid URL',
          message: 'Could not parse the request URL',
          fallback: formatResponse(await getFallbackCity('invalid-url')),
          requestId,
        } as ZipCodeErrorResponse,
        400
      );
    }

    // Extract the ZIP code from path parameters - highest priority
    let zipCode = null;

    // Look for patterns like:
    // /zipcode/{zipcode}
    // /zipcode/{zipcode}/{cachebuster}
    // /zipcode/postal/{zipcode}
    // /zipcode/postal/{zipcode}/unique/{cachebuster}
    const pathRegex =
      /\/(?:zipcode|api\/zipcode)(?:\/postal)?\/(\d{5})(?:\/.*)?$/i;
    const pathMatch = pathRegex.exec(url.pathname);

    if (pathMatch && pathMatch[1]) {
      zipCode = pathMatch[1];
      console.log(`Found ZIP in pathname ${requestId}: ${zipCode}`);
    }

    if (!zipCode) {
      console.log(`No ZIP code found in path ${requestId}. Using fallback.`);
      return createResponse(
        {
          error: 'No ZIP code found',
          message: 'Could not extract ZIP code from path',
          fallback: formatResponse(await getFallbackCity('no-zip-in-path')),
          requestId,
        },
        400
      );
    }

    // Sanitize the ZIP code - any non-digits are removed
    zipCode = zipCode.replace(/\D/g, '');
    console.log(`Sanitized ZIP code ${requestId}: ${zipCode}`);

    // Ensure the ZIP is a 5-digit string
    const fiveDigitZip = zipCode.toString().padStart(5, '0').substring(0, 5);
    console.log(`Formatted 5-digit ZIP ${requestId}: ${fiveDigitZip}`);

    // Process the ZIP code with a timeout to avoid serverless function timeouts
    const locationData = await processZipCodeWithTimeout(fiveDigitZip);

    if (locationData) {
      console.log(
        `Found location for ZIP ${fiveDigitZip} ${requestId}:`,
        JSON.stringify(locationData)
      );
      const response = formatResponse(locationData, fiveDigitZip);
      response.requestId = requestId;
      return createResponse(response);
    }

    // If all else fails, return a fallback
    console.log(
      `No location data for ZIP ${fiveDigitZip} ${requestId}, using fallback`
    );
    const fallbackResponse = formatResponse(
      await getFallbackCity('complete-fallback'),
      fiveDigitZip
    );
    fallbackResponse.requestId = requestId;
    return createResponse(fallbackResponse);
  } catch (error) {
    console.error(`ZIP API error:`, error);

    // Return fallback from database
    return createResponse(
      {
        error: 'Failed to process ZIP code',
        message: error instanceof Error ? error.message : 'Unknown error',
        fallback: formatResponse(await getFallbackCity('error-fallback')),
        requestId: `err_${Date.now()}`,
      } as ZipCodeErrorResponse,
      500
    );
  }
}) satisfies APIRoute;

// Also export a POST handler for backward compatibility
export const POST = (async ({ request }) => {
  const timestamp = Date.now();
  console.log(`Received POST request at ${new Date(timestamp).toISOString()}`);

  try {
    const requestId = `req_${timestamp}_${Math.floor(Math.random() * 10000)}`;
    let body;
    let zipCode;
    let clientRequestId = null;

    try {
      body = await request.json();
      zipCode = body.zip?.toString();
      clientRequestId = body.requestId || null;
      console.log(`POST request body: ${JSON.stringify(body)}`);
    } catch (error) {
      console.error('Error parsing request body:', error);
      return createResponse(
        {
          error: 'Invalid request body',
          message: 'The request body could not be parsed as JSON',
          timestamp: new Date().toISOString(),
          requestId: requestId,
        },
        400
      );
    }

    if (!zipCode) {
      return createResponse(
        {
          error: 'Missing zip parameter',
          message:
            'Please provide a ZIP code in the request body as { "zip": "12345" }',
          timestamp: new Date().toISOString(),
          requestId: requestId,
        },
        400
      );
    }

    console.log(
      `Processing POST ZIP code request: ${zipCode} (request ID: ${requestId})`
    );
    const result = await processZipCodeWithTimeout(zipCode);

    if (result) {
      const response = formatResponse(result, zipCode);
      response.requestId = requestId;
      response.clientRequestId = clientRequestId;
      response.timestamp = new Date().toISOString();
      response.parsedBody = { ...body };
      return createResponse(response);
    } else {
      console.log(`No result found for ZIP code ${zipCode}`);
      const fallback = await getFallbackCity('api-fallback');

      const response = {
        error: 'No city found for the provided ZIP code',
        message: `Could not find a city for ZIP code ${zipCode}`,
        fallback: formatResponse(fallback, zipCode),
        requestedZip: zipCode,
        requestId: requestId,
        clientRequestId: clientRequestId,
        timestamp: new Date().toISOString(),
        parsedBody: { ...body },
      };

      return createResponse(response, 404);
    }
  } catch (error) {
    console.error('Error processing ZIP code request:', error);
    return createResponse(
      {
        error: 'Internal server error',
        message:
          error instanceof Error ? error.message : 'An unknown error occurred',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
}) satisfies APIRoute;

export const OPTIONS: APIRoute = async ({ request }) => {
  // Support for OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      message:
        'This endpoint supports OPTIONS for CORS preflight and POST for ZIP code queries',
    }),
    {
      status: 200,
      headers: corsHeaders,
    }
  );
};
