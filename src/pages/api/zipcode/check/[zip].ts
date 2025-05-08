import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

/**
 * Simple API endpoint to check if a ZIP code exists in our database
 * Returns { found: true/false, city, state } if found
 */
export const GET: APIRoute = async ({ params, request }) => {
  // Extract the ZIP code from the URL parameters
  const zipCode = params.zip;
  console.log(`Checking if ZIP code ${zipCode} exists in database`);

  if (!zipCode || !/^\d{5}$/.test(zipCode)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid ZIP code format',
        found: false,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }

  try {
    // Check our database for this ZIP code - try both integer and string forms
    // First, try as integer
    const { data: intData, error: intError } = await supabase
      .from('recycling_centers')
      .select('city, state')
      .eq('postal_code', parseInt(zipCode, 10))
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1);

    // If no results found as integer, try as string
    const { data: strData, error: strError } = !intData?.length
      ? await supabase
          .from('recycling_centers')
          .select('city, state')
          .eq('postal_code', zipCode)
          .not('city', 'is', null)
          .not('state', 'is', null)
          .limit(1)
      : { data: null, error: null };

    const data = intData?.length ? intData : strData;
    const error = intError || strError;

    if (error) {
      console.error(`Error querying database for ZIP ${zipCode}:`, error);
      return new Response(
        JSON.stringify({
          error: 'Database query error',
          found: false,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // If we found a match in our database, return it
    if (data && data.length > 0 && data[0].city && data[0].state) {
      console.log(
        `Found ZIP ${zipCode} in database: ${data[0].city}, ${data[0].state}`
      );
      return new Response(
        JSON.stringify({
          found: true,
          city: data[0].city,
          state: data[0].state,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // No match found
    console.log(`ZIP code ${zipCode} not found in database`);
    return new Response(
      JSON.stringify({
        found: false,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error(`Error checking ZIP code ${zipCode}:`, error);
    return new Response(
      JSON.stringify({
        error: 'Server error',
        found: false,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
};
