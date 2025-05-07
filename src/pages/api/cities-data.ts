import type { APIRoute } from 'astro';
import { getAllCityStatePairs } from '../../lib/cityData';
import { supabase } from '../../lib/supabase';

export const prerender = false;

interface CityWithCoordinates {
  city: string;
  state: string;
  url: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With',
  'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching
  Pragma: 'no-cache', // Additional cache prevention for older browsers
  Expires: '0', // Immediate expiration
};

// DEBUGGING FLAG
const DEBUG = true;

// Enhanced logging function
function log(...args: any[]) {
  if (DEBUG) {
    console.log('[CITIES API]', ...args);
  }
}

export const config = {
  runtime: 'edge',
};

const handler: APIRoute = async ({ request }): Promise<Response> => {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    log('Handling OPTIONS request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    log('Cities data API call received');
    log(`Request URL: ${request.url}`);
    log(`Request timestamp: ${new Date().toISOString()}`);

    // Get all city-state pairs
    const cityStatePairs = await getAllCityStatePairs();
    log(`Retrieved ${cityStatePairs.length} city-state pairs`);

    // Now let's enhance the data with coordinates from the database
    const citiesWithCoordinates: CityWithCoordinates[] = [...cityStatePairs];

    log('Fetching coordinates from recycling_centers table...');

    // Get coordinates for all cities from database
    const { data: cityCoordinates, error } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      log('Error fetching city coordinates:', error);
      return new Response(
        JSON.stringify({
          data: cityStatePairs,
          error: 'Error fetching city coordinates',
          message: error.message,
          details: error,
          coordinatesAvailable: false,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200, // Still return 200 to allow client to use data without coordinates
          headers: corsHeaders,
        }
      );
    }

    log(
      `Retrieved ${
        cityCoordinates?.length || 0
      } coordinate records from database`
    );

    if (!cityCoordinates || cityCoordinates.length === 0) {
      log('No coordinates found in database!');

      // Include fallback hard-coded coordinates for major cities
      // This ensures we always have some coordinates data even if DB lookup fails
      const fallbackCoordinates = [
        {
          city: 'New York',
          state: 'New York',
          latitude: 40.7128,
          longitude: -74.006,
        },
        {
          city: 'Los Angeles',
          state: 'California',
          latitude: 34.0522,
          longitude: -118.2437,
        },
        {
          city: 'Chicago',
          state: 'Illinois',
          latitude: 41.8781,
          longitude: -87.6298,
        },
        {
          city: 'Houston',
          state: 'Texas',
          latitude: 29.7604,
          longitude: -95.3698,
        },
        {
          city: 'Phoenix',
          state: 'Arizona',
          latitude: 33.4484,
          longitude: -112.074,
        },
        {
          city: 'Indianapolis',
          state: 'Indiana',
          latitude: 39.7684,
          longitude: -86.1581,
        },
        // Add more fallback cities as needed
      ];

      log(`Adding ${fallbackCoordinates.length} fallback city coordinates...`);
      const coordinatesAdded = enhanceCitiesWithFallbackCoordinates(
        citiesWithCoordinates,
        fallbackCoordinates
      );
      log(`Added coordinates for ${coordinatesAdded} cities`);

      return new Response(
        JSON.stringify({
          data: citiesWithCoordinates,
          warning: 'Using fallback coordinates for major cities',
          coordinatesAvailable: coordinatesAdded > 0,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // When we have coordinates from DB, enhance the city data
    log('Adding DB coordinates to city data...');

    // Build a map for faster lookups
    const coordinatesMap = new Map<string, { lat: number; lng: number }>();

    cityCoordinates.forEach((center) => {
      const key = `${center.city.toLowerCase()}-${center.state.toLowerCase()}`;

      if (center.latitude && center.longitude) {
        coordinatesMap.set(key, {
          lat: center.latitude,
          lng: center.longitude,
        });
      }
    });

    // Now enhance each city with coordinates
    let coordinatesAdded = 0;

    citiesWithCoordinates.forEach((city) => {
      const key = `${city.city.toLowerCase()}-${city.state.toLowerCase()}`;

      if (coordinatesMap.has(key)) {
        city.coordinates = coordinatesMap.get(key);
        coordinatesAdded++;
      }
    });

    log(`Added coordinates to ${coordinatesAdded} cities from database`);

    // If some cities still don't have coordinates, try adding fallbacks
    if (coordinatesAdded < citiesWithCoordinates.length) {
      log(
        `${
          citiesWithCoordinates.length - coordinatesAdded
        } cities still lack coordinates, adding fallbacks...`
      );

      // Use fallback coordinates as well
      const fallbackCoordinates = [
        {
          city: 'New York',
          state: 'New York',
          latitude: 40.7128,
          longitude: -74.006,
        },
        {
          city: 'Los Angeles',
          state: 'California',
          latitude: 34.0522,
          longitude: -118.2437,
        },
        {
          city: 'Chicago',
          state: 'Illinois',
          latitude: 41.8781,
          longitude: -87.6298,
        },
        {
          city: 'Houston',
          state: 'Texas',
          latitude: 29.7604,
          longitude: -95.3698,
        },
        {
          city: 'Phoenix',
          state: 'Arizona',
          latitude: 33.4484,
          longitude: -112.074,
        },
      ];

      const additionalCoordsAdded = enhanceCitiesWithFallbackCoordinates(
        citiesWithCoordinates.filter((city) => !city.coordinates),
        fallbackCoordinates
      );

      log(
        `Added fallback coordinates for ${additionalCoordsAdded} more cities`
      );
      coordinatesAdded += additionalCoordsAdded;
    }

    log(
      `Returning data with ${coordinatesAdded}/${citiesWithCoordinates.length} cities having coordinates`
    );

    return new Response(JSON.stringify(citiesWithCoordinates), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    log('Error processing request:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process request',
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
};

// Helper function to add fallback coordinates to cities
function enhanceCitiesWithFallbackCoordinates(
  cities: CityWithCoordinates[],
  fallbackCoordinates: Array<{
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  }>
): number {
  let coordinatesAdded = 0;

  fallbackCoordinates.forEach((fallback) => {
    const matchingCities = cities.filter(
      (city) =>
        !city.coordinates &&
        city.city.toLowerCase() === fallback.city.toLowerCase() &&
        city.state.toLowerCase() === fallback.state.toLowerCase()
    );

    matchingCities.forEach((city) => {
      city.coordinates = {
        lat: fallback.latitude,
        lng: fallback.longitude,
      };
      coordinatesAdded++;
    });
  });

  return coordinatesAdded;
}

export const GET = handler;

// Also export as default
export default handler;
