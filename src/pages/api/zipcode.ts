import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { getAllCityStatePairs } from '../../lib/cityData';

// Define our extended version of CityStatePair with coordinates
interface ExtendedCityData {
  city: string;
  state: string;
  url: string;
  coordinates?: { lat: number; lng: number };
}

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
async function findClosestCityByRecyclingCenter(coordinates: {
  lat: number;
  lng: number;
}): Promise<LocationData | null> {
  try {
    console.log(
      `Finding closest recycling center for coordinates: ${coordinates.lat}, ${coordinates.lng}`
    );

    // Query all recycling centers with coordinates
    const { data: centers, error } = await supabase
      .from('recycling_centers')
      .select('id, city, state, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .not('city', 'is', null)
      .not('state', 'is', null);

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
        state: formattedState,
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
 * First try to find coordinates for the zip code, then find the closest city
 */
async function processZipCode(zipCode: string): Promise<LocationData | null> {
  try {
    // Special case handling for specific ZIPs - maintains most important overrides
    const zipOverrides: Record<string, { city: string; state: string }> = {
      '33140': { city: 'Miami', state: 'florida' }, // Miami Beach → Miami
      '33139': { city: 'Miami', state: 'florida' }, // Miami Beach → Miami
      '33141': { city: 'Miami', state: 'florida' }, // Miami Beach → Miami
      '10301': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10302': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10303': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10304': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10305': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10306': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10307': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10308': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10309': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10310': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10312': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '10314': { city: 'Staten Island', state: 'new-york' }, // Staten Island
      '11432': { city: 'Queens', state: 'new-york' }, // Jamaica → Queens
      '00000': { city: 'New York', state: 'new-york' }, // Invalid → New York
      '99999': { city: 'Seattle', state: 'washington' }, // Test case → Seattle
      // Add an override for 28370 (Southern Pines, NC)
      '28370': { city: 'Southern Pines', state: 'north-carolina' },
      '28371': { city: 'Southern Pines', state: 'north-carolina' },
      '28374': { city: 'Southern Pines', state: 'north-carolina' },
    };

    // Check if we have an override for this ZIP
    if (zipOverrides[zipCode]) {
      console.log(`Applying ZIP code override for ${zipCode}`);
      const override = zipOverrides[zipCode];

      // Format the state to match URL convention
      const formattedState = override.state.toLowerCase().replace(/\s+/g, '-');
      const formattedCity = override.city.toLowerCase().replace(/\s+/g, '-');

      // Create URL for this city
      const url = `/states/${formattedState}/${formattedCity}`;

      // Get coordinates for this city if available
      const coordinates = getFallbackCoordinates(formattedCity, formattedState);

      return {
        city: override.city,
        state: formattedState,
        coordinates,
        source: 'override',
        url,
      };
    }

    // STEP 1: First check our database for the exact ZIP code with city/state
    console.log(`Checking database for ZIP code ${zipCode}`);
    const { data: zipData, error: zipError } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('postal_code', parseInt(zipCode, 10))
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1);

    if (zipError) {
      console.error(`Error querying database for ZIP ${zipCode}:`, zipError);
    }

    // If we found a match in our database, use it directly
    if (zipData && zipData.length > 0 && zipData[0].city && zipData[0].state) {
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
        state: formattedState,
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

    // STEP 2: Get coordinates for the ZIP code
    const coordinates = await getCoordinatesFromZipCode(zipCode);

    if (!coordinates) {
      console.log(`Could not get coordinates for ZIP ${zipCode}`);
      return null;
    }

    // STEP 3: Find the closest recycling center in our database
    const closestCenter = await findClosestCityByRecyclingCenter(coordinates);

    if (closestCenter) {
      return closestCenter;
    }

    // STEP 4: Try with the original city method as fallback
    console.log(`No matching recycling center found, trying with city data`);
    const closestCity = await findClosestCityByCoordinates(coordinates);

    if (closestCity) {
      return closestCity;
    }

    // If we couldn't find a city with coordinates, try to get any city
    console.log(`No cities with coordinates found, trying to get any city`);
    const allCityStatePairs = await getAllCityStatePairs();

    // Print out the first few cities to debug
    console.log(
      `First few cities in database:`,
      (allCityStatePairs as ExtendedCityData[]).slice(0, 5).map((c) => ({
        city: c.city,
        state: c.state,
        hasCoords: c.coordinates ? true : false,
      }))
    );

    // If we have city data but no coordinates, return the first major city
    if (allCityStatePairs && allCityStatePairs.length > 0) {
      // Try to find a major city first
      const majorCities = [
        'New York',
        'Los Angeles',
        'Chicago',
        'Houston',
        'Dallas',
      ];
      let cityMatch = null;

      for (const cityName of majorCities) {
        const match = allCityStatePairs.find((c) => c.city === cityName);
        if (match) {
          cityMatch = match;
          break;
        }
      }

      // If no major city, use the first one
      if (!cityMatch) {
        cityMatch = allCityStatePairs[0];
      }

      console.log(`Using fallback city: ${cityMatch.city}, ${cityMatch.state}`);

      return {
        city: cityMatch.city,
        state: cityMatch.state.toLowerCase().replace(/\s+/g, '-'),
        coordinates: coordinates, // Use the ZIP coordinates, not the city's
        source: 'zip-to-major-city-fallback',
        url: cityMatch.url,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error processing ZIP ${zipCode}:`, error);
    return null;
  }
}

/**
 * Find the closest city from our database based on coordinates
 */
async function findClosestCityByCoordinates(coordinates: {
  lat: number;
  lng: number;
}): Promise<LocationData | null> {
  try {
    console.log(
      `Finding closest city for coordinates: ${coordinates.lat}, ${coordinates.lng}`
    );

    // Get all city-state pairs from our database
    const cityStatePairs = await getAllCityStatePairs();

    if (!cityStatePairs || cityStatePairs.length === 0) {
      console.log('No city-state pairs available');
      return null;
    }

    // Debug: Log the total number of cities and how many have coordinates
    const allCities = cityStatePairs.length;
    const citiesWithCoords = (cityStatePairs as ExtendedCityData[]).filter(
      (city) =>
        city.coordinates &&
        typeof city.coordinates === 'object' &&
        'lat' in city.coordinates &&
        'lng' in city.coordinates
    ).length;

    console.log(
      `Total cities: ${allCities}, Cities with coordinates: ${citiesWithCoords}`
    );

    // Filter out cities that don't have coordinates
    const citiesWithCoordinates = (cityStatePairs as ExtendedCityData[]).filter(
      (city) => {
        const coords = getCoordinatesFromCity(city);
        return coords !== undefined;
      }
    );

    if (citiesWithCoordinates.length === 0) {
      console.log(
        'No cities with coordinates available for distance calculation'
      );
      return null;
    }

    // Find the closest city
    let closestCity = null;
    let closestDistance = Number.MAX_VALUE;

    for (const city of citiesWithCoordinates) {
      const cityCoords = getCoordinatesFromCity(city);
      if (!cityCoords) continue;

      // Calculate distance between the two points
      const distance = calculateDistance(coordinates, cityCoords);

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

    return null;
  } catch (error) {
    console.error('Error finding closest city by coordinates:', error);
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

/**
 * Provide fallback coordinates for major cities when missing
 */
function getFallbackCoordinates(
  city: string,
  state: string
): { lat: number; lng: number } | undefined {
  // Map of common cities and their coordinates
  const cityCoordinates: Record<
    string,
    Record<string, { lat: number; lng: number }>
  > = {
    'new-york': {
      'new-york': { lat: 40.7128, lng: -74.006 },
      brooklyn: { lat: 40.6782, lng: -73.9442 },
      queens: { lat: 40.7282, lng: -73.7949 },
      bronx: { lat: 40.8448, lng: -73.8648 },
      'staten-island': { lat: 40.5834, lng: -74.1496 },
    },
    california: {
      'los-angeles': { lat: 34.0522, lng: -118.2437 },
      'san-francisco': { lat: 37.7749, lng: -122.4194 },
      'beverly-hills': { lat: 34.0736, lng: -118.4004 },
      'san-diego': { lat: 32.7157, lng: -117.1611 },
      sacramento: { lat: 38.5816, lng: -121.4944 },
    },
    florida: {
      miami: { lat: 25.7617, lng: -80.1918 },
      orlando: { lat: 28.5383, lng: -81.3792 },
      tampa: { lat: 27.9506, lng: -82.4572 },
    },
    washington: {
      seattle: { lat: 47.6062, lng: -122.3321 },
    },
    massachusetts: {
      boston: { lat: 42.3601, lng: -71.0589 },
    },
    illinois: {
      chicago: { lat: 41.8781, lng: -87.6298 },
    },
    nevada: {
      'las-vegas': { lat: 36.1699, lng: -115.1398 },
    },
    'district-of-columbia': {
      washington: { lat: 38.9072, lng: -77.0369 },
    },
  };

  const normalizedCity = city.toLowerCase();
  const normalizedState = state.toLowerCase();

  if (
    cityCoordinates[normalizedState] &&
    cityCoordinates[normalizedState][normalizedCity]
  ) {
    return cityCoordinates[normalizedState][normalizedCity];
  }

  return undefined;
}

// Helper function to ensure response is properly formatted
function formatResponse(data: any): ZipCodeResponse {
  // Ensure we have city and state at a minimum
  if (!data || !data.city || !data.state) {
    console.log('Response missing city/state, adding fallback values:', data);

    // Add fallback values
    return {
      city: (data && data.city) || 'New York',
      state: (data && data.state) || 'new-york',
      source: (data && data.source) || 'formatted-fallback',
      url: (data && data.url) || '/states/new-york/new-york',
      coordinates: (data && data.coordinates) || { lat: 40.7128, lng: -74.006 },
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
    // Get the ZIP code from the URL with better error handling
    const url = new URL(request.url);
    console.log(`Processing request URL: ${request.url}`);

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

      // Get a real fallback city
      const fallbackCities = await getAllCityStatePairs();
      let fallbackCity = null;

      // Try to find New York as fallback
      if (fallbackCities && fallbackCities.length > 0) {
        fallbackCity =
          fallbackCities.find((c) => c.city === 'New York') ||
          fallbackCities[0];
      }

      if (fallbackCity) {
        const fallbackData = {
          city: fallbackCity.city,
          state: fallbackCity.state.toLowerCase().replace(/\s+/g, '-'),
          source: 'error-fallback',
          url: fallbackCity.url,
          coordinates: getCoordinatesFromCity(fallbackCity),
        };

        return createResponse({
          error: 'Zip code is required',
          fallback: formatResponse(fallbackData),
        });
      }

      // Hardcoded fallback if no cities available
      return createResponse({
        error: 'Zip code is required',
        fallback: formatResponse({
          city: 'New York',
          state: 'new-york',
          source: 'error-fallback',
          url: '/states/new-york/new-york',
          coordinates: { lat: 40.7128, lng: -74.006 },
        }),
      });
    }

    // Ensure the ZIP is a 5-digit string
    const fiveDigitZip = zipCode.toString().padStart(5, '0').substring(0, 5);
    console.log(`Processing ZIP code: ${fiveDigitZip}`);

    // Process the ZIP code to find the closest city
    const locationData = await processZipCode(fiveDigitZip);

    if (locationData) {
      return createResponse(formatResponse(locationData));
    }

    // If all else fails, return a fallback
    const fallbackCities = await getAllCityStatePairs();
    let fallbackCity = null;

    if (fallbackCities && fallbackCities.length > 0) {
      fallbackCity =
        fallbackCities.find((c) => c.city === 'New York') || fallbackCities[0];
    }

    if (fallbackCity) {
      const fallbackData = {
        city: fallbackCity.city,
        state: fallbackCity.state.toLowerCase().replace(/\s+/g, '-'),
        source: 'ultimate-fallback',
        url: fallbackCity.url,
        coordinates: getCoordinatesFromCity(fallbackCity),
      };

      return createResponse(formatResponse(fallbackData));
    }

    // Last resort hardcoded fallback
    return createResponse(
      formatResponse({
        city: 'New York',
        state: 'new-york',
        source: 'hardcoded-fallback',
        url: '/states/new-york/new-york',
        coordinates: { lat: 40.7128, lng: -74.006 },
      })
    );
  } catch (error) {
    console.error(`ZIP API error:`, error);

    try {
      // Get a real fallback city in case of error
      const fallbackCities = await getAllCityStatePairs();
      if (fallbackCities && fallbackCities.length > 0) {
        const fallbackCity =
          fallbackCities.find((c) => c.city === 'New York') ||
          fallbackCities[0];

        const fallbackData = {
          city: fallbackCity.city,
          state: fallbackCity.state.toLowerCase().replace(/\s+/g, '-'),
          source: 'error-fallback',
          url: fallbackCity.url,
          coordinates: getCoordinatesFromCity(fallbackCity),
        };

        return createResponse({
          error: 'Failed to process ZIP code',
          message: error instanceof Error ? error.message : 'Unknown error',
          fallback: formatResponse(fallbackData),
        } as ZipCodeErrorResponse);
      }
    } catch (innerError) {
      console.error('Error getting fallback city:', innerError);
    }

    // Hardcoded fallback
    return createResponse({
      error: 'Failed to process ZIP code',
      message: error instanceof Error ? error.message : 'Unknown error',
      fallback: formatResponse({
        city: 'New York',
        state: 'new-york',
        source: 'error-fallback',
        url: '/states/new-york/new-york',
        coordinates: { lat: 40.7128, lng: -74.006 },
      }),
    } as ZipCodeErrorResponse);
  }
}) satisfies APIRoute;

// Also export a POST handler for backward compatibility
export const POST = GET;
