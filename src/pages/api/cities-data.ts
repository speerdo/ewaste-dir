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
    // Get all city-state pairs
    const cityStatePairs = await getAllCityStatePairs();

    // Now let's enhance the data with coordinates from the database
    const citiesWithCoordinates: CityWithCoordinates[] = [...cityStatePairs];

    // Get coordinates for all cities from database
    const { data: cityCoordinates, error } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.error('Error fetching city coordinates:', error);
      return new Response(JSON.stringify(cityStatePairs), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Create a mapping of city+state to coordinates
    const coordinatesMap = new Map();
    cityCoordinates?.forEach((record) => {
      const key = `${record.city.toLowerCase()},${record.state.toLowerCase()}`;
      // Only add if not already present (to avoid duplicates)
      if (!coordinatesMap.has(key) && record.latitude && record.longitude) {
        coordinatesMap.set(key, {
          lat: record.latitude,
          lng: record.longitude,
        });
      }
    });

    // Enhance city data with coordinates
    citiesWithCoordinates.forEach((cityData) => {
      const key = `${cityData.city.toLowerCase()},${cityData.state.toLowerCase()}`;
      const coordinates = coordinatesMap.get(key);
      if (coordinates) {
        cityData.coordinates = coordinates;
      }
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
