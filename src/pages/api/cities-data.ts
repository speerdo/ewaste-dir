import type { APIRoute } from 'astro';
import { getAllCityStatePairs } from '../../lib/cityData';

export const prerender = false;

// Explicitly set as edge function
export const config = {
  runtime: 'edge',
};

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
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

// Major cities with hardcoded coordinates
const majorCities = [
  {
    city: 'New York',
    state: 'New York',
    coordinates: { lat: 40.7128, lng: -74.006 },
  },
  {
    city: 'Los Angeles',
    state: 'California',
    coordinates: { lat: 34.0522, lng: -118.2437 },
  },
  {
    city: 'Chicago',
    state: 'Illinois',
    coordinates: { lat: 41.8781, lng: -87.6298 },
  },
  {
    city: 'Houston',
    state: 'Texas',
    coordinates: { lat: 29.7604, lng: -95.3698 },
  },
  {
    city: 'Phoenix',
    state: 'Arizona',
    coordinates: { lat: 33.4484, lng: -112.074 },
  },
  {
    city: 'Philadelphia',
    state: 'Pennsylvania',
    coordinates: { lat: 39.9526, lng: -75.1652 },
  },
  {
    city: 'San Antonio',
    state: 'Texas',
    coordinates: { lat: 29.4241, lng: -98.4936 },
  },
  {
    city: 'San Diego',
    state: 'California',
    coordinates: { lat: 32.7157, lng: -117.1611 },
  },
  {
    city: 'Dallas',
    state: 'Texas',
    coordinates: { lat: 32.7767, lng: -96.797 },
  },
  {
    city: 'San Jose',
    state: 'California',
    coordinates: { lat: 37.3382, lng: -121.8863 },
  },
  {
    city: 'Indianapolis',
    state: 'Indiana',
    coordinates: { lat: 39.7684, lng: -86.1581 },
  },
  {
    city: 'Miami',
    state: 'Florida',
    coordinates: { lat: 25.7617, lng: -80.1918 },
  },
];

export const GET: APIRoute = async ({ request }) => {
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

    // Enhance known major cities with coordinates
    const cityMap = new Map();
    majorCities.forEach((city) => {
      const key = `${city.city.toLowerCase()}-${city.state.toLowerCase()}`;
      cityMap.set(key, city.coordinates);
    });

    // Apply coordinates to city pairs
    const citiesWithCoordinates = cityStatePairs.map((city) => {
      const key = `${city.city.toLowerCase()}-${city.state.toLowerCase()}`;
      if (cityMap.has(key)) {
        return {
          ...city,
          coordinates: cityMap.get(key),
        };
      }
      return city;
    });

    return new Response(JSON.stringify(citiesWithCoordinates), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Cities data API error:', error);

    // Return a minimal fallback in case of error
    return new Response(
      JSON.stringify([
        {
          city: 'New York',
          state: 'New York',
          url: '/states/new-york/new-york',
          coordinates: { lat: 40.7128, lng: -74.006 },
        },
        {
          city: 'Los Angeles',
          state: 'California',
          url: '/states/california/los-angeles',
          coordinates: { lat: 34.0522, lng: -118.2437 },
        },
      ]),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  }
};
