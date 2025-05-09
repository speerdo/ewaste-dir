import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import fs from 'node:fs';
import path from 'node:path';

export const prerender = false;

interface CityWithCoordinates {
  city: string; // Corresponds to city_name from SQL function
  state: string; // Corresponds to state_name from SQL function
  url: string;
  coordinates?: {
    // Corresponds to latitude, longitude from SQL function
    lat: number;
    lng: number;
  };
}

const responseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  // Cache city data for 1 hour
  'Cache-Control': 'public, max-age=3600',
};

export const config = {
  runtime: 'edge',
};

// Function to read the generated city data file
async function readGeneratedCityData(): Promise<CityWithCoordinates[]> {
  try {
    console.log('Trying to read the generated city data file');
    // Read the local JSON file
    const filePath = path.join(
      process.cwd(),
      'src',
      'data',
      'generatedCityData.json'
    );
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error: any) {
    console.error('Error reading generated city data file:', error);
    // Fallback to RPC call if file reading fails
    console.log('Falling back to RPC call for city data');
    const { data, error: rpcError } = await supabase.rpc(
      'get_city_data_for_search_v2'
    );

    if (rpcError) {
      console.error('Error in fallback RPC call:', rpcError);
      throw new Error(`RPC error: ${rpcError.message}`);
    }

    return (data || []).map((row: any) => ({
      city: row.city_name,
      state: row.state_name,
      url: row.url,
      coordinates:
        row.latitude && row.longitude
          ? { lat: row.latitude, lng: row.longitude }
          : undefined,
    }));
  }
}

const handler: APIRoute = async ({ request }): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  try {
    // First try to use the generated file with complete city data
    const citiesData = await readGeneratedCityData();

    return new Response(JSON.stringify(citiesData), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('Error in cities-data API:', e);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: e.message }),
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }
};

export const GET = handler;
export const get = handler;
export default handler;
