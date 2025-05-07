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
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching
  Pragma: 'no-cache', // Additional cache prevention for older browsers
  Expires: '0', // Immediate expiration
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
    console.log('Cities data API call received');
    console.log(`Request URL: ${request.url}`);
    console.log(`Request timestamp: ${new Date().toISOString()}`);

    // Get all city-state pairs
    const cityStatePairs = await getAllCityStatePairs();
    console.log(`Retrieved ${cityStatePairs.length} city-state pairs`);

    // Now let's enhance the data with coordinates from the database
    const citiesWithCoordinates: CityWithCoordinates[] = [...cityStatePairs];

    console.log('Fetching coordinates from recycling_centers table...');

    // Get coordinates for all cities from database
    const { data: cityCoordinates, error } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.error('Error fetching city coordinates:', error);
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

    console.log(
      `Retrieved ${
        cityCoordinates?.length || 0
      } coordinate records from database`
    );

    if (!cityCoordinates || cityCoordinates.length === 0) {
      console.warn('No coordinates found in database!');

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
          city: 'Philadelphia',
          state: 'Pennsylvania',
          latitude: 39.9526,
          longitude: -75.1652,
        },
        {
          city: 'San Antonio',
          state: 'Texas',
          latitude: 29.4241,
          longitude: -98.4936,
        },
        {
          city: 'San Diego',
          state: 'California',
          latitude: 32.7157,
          longitude: -117.1611,
        },
        {
          city: 'Dallas',
          state: 'Texas',
          latitude: 32.7767,
          longitude: -96.797,
        },
        {
          city: 'San Jose',
          state: 'California',
          latitude: 37.3382,
          longitude: -121.8863,
        },
        {
          city: 'Austin',
          state: 'Texas',
          latitude: 30.2672,
          longitude: -97.7431,
        },
        {
          city: 'Indianapolis',
          state: 'Indiana',
          latitude: 39.7684,
          longitude: -86.1581,
        },
        {
          city: 'Jacksonville',
          state: 'Florida',
          latitude: 30.3322,
          longitude: -81.6557,
        },
        {
          city: 'San Francisco',
          state: 'California',
          latitude: 37.7749,
          longitude: -122.4194,
        },
        {
          city: 'Columbus',
          state: 'Ohio',
          latitude: 39.9612,
          longitude: -82.9988,
        },
        {
          city: 'Charlotte',
          state: 'North Carolina',
          latitude: 35.2271,
          longitude: -80.8431,
        },
        {
          city: 'Detroit',
          state: 'Michigan',
          latitude: 42.3314,
          longitude: -83.0458,
        },
        {
          city: 'El Paso',
          state: 'Texas',
          latitude: 31.7619,
          longitude: -106.485,
        },
        {
          city: 'Memphis',
          state: 'Tennessee',
          latitude: 35.1495,
          longitude: -90.049,
        },
        {
          city: 'Seattle',
          state: 'Washington',
          latitude: 47.6062,
          longitude: -122.3321,
        },
        {
          city: 'Denver',
          state: 'Colorado',
          latitude: 39.7392,
          longitude: -104.9903,
        },
        {
          city: 'Boston',
          state: 'Massachusetts',
          latitude: 42.3601,
          longitude: -71.0589,
        },
        {
          city: 'Nashville',
          state: 'Tennessee',
          latitude: 36.1627,
          longitude: -86.7816,
        },
        {
          city: 'Baltimore',
          state: 'Maryland',
          latitude: 39.2904,
          longitude: -76.6122,
        },
        {
          city: 'Portland',
          state: 'Oregon',
          latitude: 45.5051,
          longitude: -122.675,
        },
        {
          city: 'Las Vegas',
          state: 'Nevada',
          latitude: 36.1699,
          longitude: -115.1398,
        },
        {
          city: 'Milwaukee',
          state: 'Wisconsin',
          latitude: 43.0389,
          longitude: -87.9065,
        },
        {
          city: 'Albuquerque',
          state: 'New Mexico',
          latitude: 35.0844,
          longitude: -106.6504,
        },
        {
          city: 'Tucson',
          state: 'Arizona',
          latitude: 32.2226,
          longitude: -110.9747,
        },
        {
          city: 'Sacramento',
          state: 'California',
          latitude: 38.5816,
          longitude: -121.4944,
        },
        {
          city: 'Atlanta',
          state: 'Georgia',
          latitude: 33.749,
          longitude: -84.388,
        },
        {
          city: 'Minneapolis',
          state: 'Minnesota',
          latitude: 44.9778,
          longitude: -93.265,
        },
        {
          city: 'Miami',
          state: 'Florida',
          latitude: 25.7617,
          longitude: -80.1918,
        },
        {
          city: 'Cleveland',
          state: 'Ohio',
          latitude: 41.4993,
          longitude: -81.6944,
        },
        {
          city: 'New Orleans',
          state: 'Louisiana',
          latitude: 29.9511,
          longitude: -90.0715,
        },
        {
          city: 'St. Louis',
          state: 'Missouri',
          latitude: 38.627,
          longitude: -90.1994,
        },
        {
          city: 'Pittsburgh',
          state: 'Pennsylvania',
          latitude: 40.4406,
          longitude: -79.9959,
        },
        {
          city: 'Cincinnati',
          state: 'Ohio',
          latitude: 39.1031,
          longitude: -84.512,
        },
        {
          city: 'Beverly Hills',
          state: 'California',
          latitude: 34.0736,
          longitude: -118.4004,
        },
      ];

      console.log(
        `Using ${fallbackCoordinates.length} fallback city coordinates`
      );

      // Use the fallback coordinates
      const enhancedWithFallbacks = enhanceCitiesWithFallbackCoordinates(
        citiesWithCoordinates,
        fallbackCoordinates
      );

      console.log(
        `Enhanced ${enhancedWithFallbacks} cities with fallback coordinates`
      );

      return new Response(
        JSON.stringify({
          data: citiesWithCoordinates,
          warning: 'Using fallback coordinates due to database lookup failure',
          coordinatesAvailable: enhancedWithFallbacks > 0,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Sample the data to verify
    if (cityCoordinates.length > 0) {
      console.log('Sample coordinate record:', {
        city: cityCoordinates[0].city,
        state: cityCoordinates[0].state,
        latitude: cityCoordinates[0].latitude,
        longitude: cityCoordinates[0].longitude,
      });
    }

    // Create a mapping of city+state to coordinates
    const coordinatesMap = new Map();
    let mappedCount = 0;

    cityCoordinates?.forEach((record) => {
      if (!record.city || !record.state) {
        return; // Skip invalid records
      }

      const key = `${record.city.toLowerCase()},${record.state.toLowerCase()}`;
      // Only add if not already present (to avoid duplicates)
      if (!coordinatesMap.has(key) && record.latitude && record.longitude) {
        coordinatesMap.set(key, {
          lat: record.latitude,
          lng: record.longitude,
        });
        mappedCount++;
      }
    });

    console.log(
      `Created mapping with ${mappedCount} unique city+state combinations`
    );

    // Enhance city data with coordinates
    let enhancedCount = 0;
    citiesWithCoordinates.forEach((cityData) => {
      const key = `${cityData.city.toLowerCase()},${cityData.state.toLowerCase()}`;
      const coordinates = coordinatesMap.get(key);
      if (coordinates) {
        cityData.coordinates = coordinates;
        enhancedCount++;
      }
    });

    console.log(
      `Enhanced ${enhancedCount} cities with coordinates data (${
        (enhancedCount / citiesWithCoordinates.length) * 100
      }% coverage)`
    );

    // Get some stats by state
    const stateStats: Record<string, { total: number; withCoords: number }> =
      {};
    citiesWithCoordinates.forEach((city) => {
      if (!stateStats[city.state]) {
        stateStats[city.state] = { total: 0, withCoords: 0 };
      }
      stateStats[city.state].total++;
      if (city.coordinates) {
        stateStats[city.state].withCoords++;
      }
    });

    // Log stats for the top 5 states
    const topStates = Object.entries(stateStats)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);

    console.log('Coordinate coverage for top states:');
    topStates.forEach(([state, stats]) => {
      console.log(
        `  ${state}: ${stats.withCoords}/${stats.total} (${Math.round(
          (stats.withCoords / stats.total) * 100
        )}%)`
      );
    });

    return new Response(JSON.stringify(citiesWithCoordinates), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Error in cities-data API:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
};

// Helper function to enhance cities with fallback coordinates
function enhanceCitiesWithFallbackCoordinates(
  cities: CityWithCoordinates[],
  fallbackCoordinates: Array<{
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  }>
): number {
  let enhancedCount = 0;

  // Create a lookup map for the fallback coordinates
  const fallbackMap = new Map();
  fallbackCoordinates.forEach((record) => {
    const key = `${record.city.toLowerCase()},${record.state.toLowerCase()}`;
    fallbackMap.set(key, {
      lat: record.latitude,
      lng: record.longitude,
    });
  });

  // Apply the fallback coordinates to any cities that lack them
  cities.forEach((city) => {
    if (!city.coordinates) {
      const key = `${city.city.toLowerCase()},${city.state.toLowerCase()}`;
      const fallbackCoords = fallbackMap.get(key);

      if (fallbackCoords) {
        city.coordinates = fallbackCoords;
        enhancedCount++;
      }
    }
  });

  return enhancedCount;
}

// Export both GET and get to handle case sensitivity
export const GET = handler;
export const get = handler;

// Also export as default
export default handler;
