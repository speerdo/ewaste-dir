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
  closestCity?: { city: string; state: string; url?: string };
}

// Interface for error responses
interface ZipCodeErrorResponse {
  error: string;
  message?: string;
  fallback?: ZipCodeResponse;
}

// Interface for Google Geocoding API response
interface GeocodeResult {
  address_components: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
  types: string[];
  postcode_localities?: string[];
}

interface GeocodeResponse {
  results: GeocodeResult[];
  status: string;
}

// First-digit ZIP code region mapping (used only as last resort fallback)
const zipFirstDigitRegions: Record<string, { state: string }> = {
  '0': { state: 'new-york' }, // Northeast (CT, MA, ME, NH, NJ, RI, VT)
  '1': { state: 'new-york' }, // Northeast (Delaware, NY, PA)
  '2': { state: 'north-carolina' }, // South Atlantic (DC, MD, NC, SC, VA, WV)
  '3': { state: 'florida' }, // Southeast (AL, FL, GA, MS, TN)
  '4': { state: 'ohio' }, // North Central (IN, KY, MI, OH)
  '5': { state: 'illinois' }, // Central (IA, MN, MT, ND, SD, WI)
  '6': { state: 'missouri' }, // Central South (IL, KS, MO, NE)
  '7': { state: 'texas' }, // South Central (AR, LA, OK, TX)
  '8': { state: 'colorado' }, // Mountain West (AZ, CO, ID, NM, NV, UT, WY)
  '9': { state: 'california' }, // West Coast (AK, CA, HI, OR, WA)
};

// More detailed mapping for specific ZIP code ranges
const zipRangeToState: Record<string, string> = {
  // More precise North Carolina ranges
  '27': 'north-carolina',
  '28': 'north-carolina',

  // Key ranges for other states
  '32': 'florida',
  '33': 'florida',
  '43': 'ohio',
  '44': 'ohio',
  '60': 'illinois',
  '61': 'illinois',
  '75': 'texas',
  '76': 'texas',
  '77': 'texas',
  '80': 'colorado',
  '81': 'colorado',
  '90': 'california',
  '91': 'california',
  '94': 'california',
  '95': 'california',
};

/**
 * Helper function to safely access coordinates from a city
 */
function getCoordinatesFromCity(
  city: any
): { lat: number; lng: number } | undefined {
  if (
    city &&
    city.coordinates &&
    typeof city.coordinates === 'object' &&
    'lat' in city.coordinates &&
    'lng' in city.coordinates
  ) {
    return {
      lat: city.coordinates.lat,
      lng: city.coordinates.lng,
    };
  }
  return undefined;
}

/**
 * Step 1: Try to find a city by ZIP code directly in our database
 */
async function findCityByZipCodeInDatabase(
  zipCode: string
): Promise<LocationData | null> {
  try {
    console.log(`Searching database for ZIP code ${zipCode}`);

    // Query recycling_centers table for the ZIP code
    const { data, error } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('postal_code', parseInt(zipCode, 10))
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1);

    if (error) {
      console.error(`Database query error for ZIP ${zipCode}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`No direct matches found in database for ZIP ${zipCode}`);
      return null;
    }

    const center = data[0];
    console.log(`Found match in database for ZIP ${zipCode}:`, center);

    // Format the state to match URL convention
    const formattedState = center.state.toLowerCase().replace(/\s+/g, '-');
    const formattedCity = center.city.toLowerCase().replace(/\s+/g, '-');

    // Create URL for this city
    const url = `/states/${formattedState}/${formattedCity}`;

    return {
      city: center.city,
      state: formattedState,
      coordinates:
        center.latitude && center.longitude
          ? {
              lat: parseFloat(center.latitude),
              lng: parseFloat(center.longitude),
            }
          : undefined,
      source: 'database',
      url,
    };
  } catch (error) {
    console.error(`Error searching database for ZIP ${zipCode}:`, error);
    return null;
  }
}

/**
 * Step 2: Use Google's Geocoding API to get ZIP code information
 */
async function getLocationFromGoogleAPI(
  zipCode: string
): Promise<LocationData | null> {
  try {
    // Google Geocoding API URL - for best results, we'll specify the country as US
    const apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${zipCode}&components=country:US&sensor=false`;

    console.log(`Fetching location data from Google API for ZIP ${zipCode}`);

    const response = await fetch(apiUrl);
    const data = (await response.json()) as GeocodeResponse;

    // Check if the API returned valid results
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log(`No results from Google API for ZIP ${zipCode}`);
      return null;
    }

    // Get the first result
    const result = data.results[0];

    // Extract city and state from address components
    let city = '';
    let state = '';
    let stateCode = '';

    for (const component of result.address_components) {
      // Check for city
      if (component.types.includes('locality')) {
        city = component.long_name;
      }
      // If no locality, try using neighborhood or sublocality
      else if (
        !city &&
        (component.types.includes('neighborhood') ||
          component.types.includes('sublocality'))
      ) {
        city = component.long_name;
      }

      // Check for state
      if (component.types.includes('administrative_area_level_1')) {
        state = component.long_name;
        stateCode = component.short_name;
      }
    }

    // If we still don't have a city, check if the result has postcode_localities
    if (
      !city &&
      result.postcode_localities &&
      result.postcode_localities.length > 0
    ) {
      city = result.postcode_localities[0];
    }

    // If we have both city and state, return the location data
    if (city && state) {
      // Format state to lowercase with dashes to match our URL format
      const formattedState = state.toLowerCase().replace(/\s+/g, '-');
      const formattedCity = city.toLowerCase().replace(/\s+/g, '-');

      // Create URL for this city
      const url = `/states/${formattedState}/${formattedCity}`;

      return {
        city: city,
        state: formattedState,
        coordinates: result.geometry.location,
        source: 'google-geocoding-api',
        url,
      };
    }

    console.log(
      `Could not extract city/state from Google API for ZIP ${zipCode}`
    );
    return null;
  } catch (error) {
    console.error(`Error fetching from Google API:`, error);
    return null;
  }
}

/**
 * Step 3: Check if the city from Google API exists in our database
 * If not, find the geographically closest city in our database
 */
async function findCityInDatabase(
  location: LocationData
): Promise<LocationData | null> {
  try {
    console.log(
      `Checking if ${location.city}, ${location.state} exists in our database`
    );

    // Get all city-state pairs from our database
    const cityStatePairs = await getAllCityStatePairs();

    if (!cityStatePairs || cityStatePairs.length === 0) {
      console.log('No city-state pairs available');
      return null;
    }

    // First, try an exact match
    const exactMatch = cityStatePairs.find(
      (pair) =>
        pair.city.toLowerCase() === location.city.toLowerCase() &&
        pair.state.toLowerCase().replace(/\s+/g, '-') ===
          location.state.toLowerCase().replace(/\s+/g, '-')
    );

    if (exactMatch) {
      console.log(
        `Found exact match in database: ${exactMatch.city}, ${exactMatch.state}`
      );
      return {
        city: exactMatch.city,
        state: exactMatch.state.toLowerCase().replace(/\s+/g, '-'),
        coordinates: location.coordinates,
        source: 'database-exact-match',
        url: exactMatch.url,
      };
    }

    console.log(
      `No exact match for ${location.city}, ${location.state} in database`
    );

    // If no exact match, try just matching the city name
    const cityMatch = cityStatePairs.find(
      (pair) => pair.city.toLowerCase() === location.city.toLowerCase()
    );

    if (cityMatch) {
      console.log(
        `Found city name match: ${cityMatch.city}, ${cityMatch.state}`
      );
      return {
        city: cityMatch.city,
        state: cityMatch.state.toLowerCase().replace(/\s+/g, '-'),
        coordinates: location.coordinates,
        source: 'database-city-name-match',
        url: cityMatch.url,
      };
    }

    // If we have coordinates, find the closest city
    if (location.coordinates) {
      console.log(`Finding closest city based on coordinates`);

      // Filter out cities that don't have coordinates
      const citiesWithCoordinates = cityStatePairs.filter((city) => {
        // Check if city has coordinates data (from cities-data.ts)
        const coords = getCoordinatesFromCity(city);
        return coords !== undefined;
      });

      if (citiesWithCoordinates.length === 0) {
        console.log(
          'No cities with coordinates available for distance calculation'
        );
        return null;
      }

      // First, try to find cities in the same state
      const citiesInSameState = citiesWithCoordinates.filter(
        (city) =>
          city.state.toLowerCase().replace(/\s+/g, '-') ===
          location.state.toLowerCase().replace(/\s+/g, '-')
      );

      const citiesToSearch =
        citiesInSameState.length > 0
          ? citiesInSameState
          : citiesWithCoordinates;

      // Find the closest city
      let closestCity = null;
      let closestDistance = Number.MAX_VALUE;

      for (const city of citiesToSearch) {
        const cityCoords = getCoordinatesFromCity(city);
        if (!cityCoords) continue;

        // Calculate distance between the two points
        const distance = calculateDistance(location.coordinates, cityCoords);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestCity = city;
        }
      }

      if (closestCity) {
        console.log(
          `Found closest city: ${closestCity.city}, ${
            closestCity.state
          } (${closestDistance.toFixed(2)}km away)`
        );
        return {
          city: closestCity.city,
          state: closestCity.state.toLowerCase().replace(/\s+/g, '-'),
          coordinates: getCoordinatesFromCity(closestCity),
          source: 'closest-by-distance',
          url: closestCity.url,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding city in database:', error);
    return null;
  }
}

/**
 * Step 4: Last resort - region-based fallback
 */
async function findCityByRegion(zipCode: string): Promise<LocationData | null> {
  try {
    console.log(`Finding city by region for ZIP ${zipCode}`);

    // First check the more specific 2-digit prefix mapping
    let stateId = null;
    if (zipCode && zipCode.length >= 2) {
      const prefix2 = zipCode.substring(0, 2);
      if (zipRangeToState[prefix2]) {
        stateId = zipRangeToState[prefix2];
        console.log(`Found state ${stateId} for ZIP prefix ${prefix2}`);
      }
    }

    // If no match in the specific ranges, use the first-digit mapping
    if (!stateId && zipCode && zipCode.length >= 1) {
      const firstDigit = zipCode.charAt(0);
      const region =
        zipFirstDigitRegions[firstDigit] || zipFirstDigitRegions['5']; // Default to central US
      stateId = region.state;
      console.log(
        `Using first-digit region mapping: ZIP ${zipCode} -> state ${stateId}`
      );
    }

    // Get all city-state pairs
    const cityStatePairs = await getAllCityStatePairs();

    if (!cityStatePairs || cityStatePairs.length === 0) {
      console.log('No city-state pairs available');
      return null;
    }

    // Try to find cities in the determined state first
    if (stateId) {
      const citiesInState = cityStatePairs.filter(
        (city) => city.state.toLowerCase().replace(/\s+/g, '-') === stateId
      );

      if (citiesInState.length > 0) {
        console.log(`Found ${citiesInState.length} cities in ${stateId}`);
        // Return the first city in the region
        const city = citiesInState[0];
        return {
          city: city.city,
          state: city.state.toLowerCase().replace(/\s+/g, '-'),
          coordinates: getCoordinatesFromCity(city),
          source: 'region-fallback',
          url: city.url,
        };
      } else {
        console.log(`No cities found in determined state ${stateId}`);
      }
    }

    // If we couldn't find a city in the determined state, use any available city
    if (cityStatePairs.length > 0) {
      const city = cityStatePairs[0];
      return {
        city: city.city,
        state: city.state.toLowerCase().replace(/\s+/g, '-'),
        coordinates: getCoordinatesFromCity(city),
        source: 'general-fallback',
        url: city.url,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error finding city by region for ZIP ${zipCode}:`, error);
    return null;
  }
}

/**
 * Helper function to calculate distance between two coordinate points
 */
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

      // Get a real fallback city
      const fallbackCities = await getAllCityStatePairs();
      let fallbackCity = null;

      // Try to find a major city to use as fallback
      if (fallbackCities && fallbackCities.length > 0) {
        // Look for major cities first
        const majorCities = [
          'New York',
          'Los Angeles',
          'Chicago',
          'Houston',
          'Phoenix',
        ];
        for (const city of majorCities) {
          const match = fallbackCities.find((c) => c.city === city);
          if (match) {
            fallbackCity = match;
            break;
          }
        }

        // If no major city found, just use the first city in the list
        if (!fallbackCity) {
          fallbackCity = fallbackCities[0];
        }
      }

      if (fallbackCity) {
        return new Response(
          JSON.stringify({
            error: 'Zip code is required',
            fallback: {
              city: fallbackCity.city,
              state: fallbackCity.state.toLowerCase().replace(/\s+/g, '-'),
              source: 'error-fallback',
              url: fallbackCity.url,
              coordinates: getCoordinatesFromCity(fallbackCity),
            },
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }

      // Hardcoded fallback if no cities available
      return new Response(
        JSON.stringify({
          error: 'Zip code is required',
          fallback: {
            city: 'New York',
            state: 'new-york',
            source: 'error-fallback',
            url: '/states/new-york/new-york',
          },
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Ensure the ZIP is a 5-digit string
    const fiveDigitZip = zipCode.toString().padStart(5, '0').substring(0, 5);
    console.log(`Processing ZIP code: ${fiveDigitZip}`);

    // STEP 1: Try to find the ZIP code directly in our database
    let locationData = await findCityByZipCodeInDatabase(fiveDigitZip);

    if (locationData) {
      console.log(`Found direct match in database for ZIP ${fiveDigitZip}`);
      return new Response(JSON.stringify(locationData), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // STEP 2: If not in our database, try Google Maps API
    console.log(`ZIP ${fiveDigitZip} not found in database, trying Google API`);
    const googleLocationData = await getLocationFromGoogleAPI(fiveDigitZip);

    if (googleLocationData) {
      console.log(`Google API returned data for ZIP ${fiveDigitZip}`);

      // STEP 3: Check if the Google-provided city exists in our database
      const databaseCity = await findCityInDatabase(googleLocationData);

      if (databaseCity) {
        console.log(
          `Found equivalent city in our database: ${databaseCity.city}, ${databaseCity.state}`
        );
        return new Response(JSON.stringify(databaseCity), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // If we couldn't find a match in our database, return the Google data
      // with a note that this might not be in our database
      console.log(
        `Returning Google API data, but city might not be in our pages`
      );
      return new Response(
        JSON.stringify({
          ...googleLocationData,
          warning: 'This city may not have a dedicated page in our system',
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // STEP 4: Both database and Google failed, use region-based fallback
    console.log(`No data from Google API, using region-based fallback`);
    const regionFallback = await findCityByRegion(fiveDigitZip);

    if (regionFallback) {
      console.log(
        `Found region-based fallback city: ${regionFallback.city}, ${regionFallback.state}`
      );
      return new Response(JSON.stringify(regionFallback), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // STEP 5: Ultimate fallback - get any available city
    console.log(`No region-based fallback, returning any available city`);
    const allCities = await getAllCityStatePairs();

    if (allCities && allCities.length > 0) {
      const defaultCity = allCities[0];
      return new Response(
        JSON.stringify({
          city: defaultCity.city,
          state: defaultCity.state.toLowerCase().replace(/\s+/g, '-'),
          source: 'ultimate-fallback',
          url: defaultCity.url,
          coordinates: getCoordinatesFromCity(defaultCity),
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Last resort hardcoded fallback
    return new Response(
      JSON.stringify({
        city: 'New York',
        state: 'new-york',
        source: 'hardcoded-fallback',
        url: '/states/new-york/new-york',
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error(`ZIP API error:`, error);

    try {
      // Get a real fallback city in case of error
      const fallbackCities = await getAllCityStatePairs();
      if (fallbackCities && fallbackCities.length > 0) {
        const fallbackCity = fallbackCities[0];

        return new Response(
          JSON.stringify({
            error: 'Failed to process ZIP code',
            message: error instanceof Error ? error.message : 'Unknown error',
            fallback: {
              city: fallbackCity.city,
              state: fallbackCity.state.toLowerCase().replace(/\s+/g, '-'),
              source: 'error-fallback',
              url: fallbackCity.url,
              coordinates: getCoordinatesFromCity(fallbackCity),
            },
          } as ZipCodeErrorResponse),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }
    } catch (innerError) {
      console.error('Error getting fallback city:', innerError);
    }

    // Hardcoded fallback
    return new Response(
      JSON.stringify({
        error: 'Failed to process ZIP code',
        message: error instanceof Error ? error.message : 'Unknown error',
        fallback: {
          city: 'New York',
          state: 'new-york',
          source: 'error-fallback',
          url: '/states/new-york/new-york',
        },
      } as ZipCodeErrorResponse),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  }
}) satisfies APIRoute;

// Also export a POST handler for backward compatibility
export const POST = GET;
