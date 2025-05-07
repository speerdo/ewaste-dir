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
      return new Response(
        JSON.stringify({
          data: cityStatePairs,
          warning: 'No coordinates available in database',
          coordinatesAvailable: false,
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

// Export both GET and get to handle case sensitivity
export const GET = handler;
export const get = handler;

// Also export as default
export default handler;
