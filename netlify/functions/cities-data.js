// netlify/functions/cities-data.js
// This is a fallback function to handle city data requests
// if the main SSR function fails to handle them

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control':
    'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
};

// Handle Netlify Function request
export async function handler(event) {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Path to the generated data file
    const dataFilePath = path.join(
      rootDir,
      'src',
      'data',
      'generatedCityData.json'
    );

    // Check if the file exists
    if (fs.existsSync(dataFilePath)) {
      // Read the file
      const fileData = fs.readFileSync(dataFilePath, 'utf8');

      // Return the data
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: fileData,
      };
    } else {
      // Return empty data if file doesn't exist
      console.log('City data file not found:', dataFilePath);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([]),
      };
    }
  } catch (error) {
    console.error('Error in cities-data function:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
}
