import { createClient } from '@supabase/supabase-js';
import type { APIRoute } from 'astro';

export interface ZipCodeResponse {
  city: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  nearby_centers?: Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    distance_meters: number;
  }>;
}

export interface ZipCodeErrorResponse {
  error: string;
  details?: Record<string, any>;
}

const responseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Cache-Control':
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export const config = {
  runtime: 'edge',
};

// Initialize Supabase client
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const handler: APIRoute = async ({ request }): Promise<Response> => {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: responseHeaders,
    });
  }

  try {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
          details: { method: request.method },
        } satisfies ZipCodeErrorResponse),
        {
          status: 405,
          headers: responseHeaders,
        }
      );
    }

    // Validate content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return new Response(
        JSON.stringify({
          error: 'Invalid Content-Type',
          details: {
            expected: 'application/json',
            received: contentType,
          },
        } satisfies ZipCodeErrorResponse),
        {
          status: 415,
          headers: responseHeaders,
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const zipCode = body.zip?.toString() ?? null;

    // Validate zip code presence
    if (!zipCode) {
      return new Response(
        JSON.stringify({
          error: 'Missing zip code',
          details: { method: request.method },
        } satisfies ZipCodeErrorResponse),
        {
          status: 400,
          headers: responseHeaders,
        }
      );
    }

    // Validate zip code format
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid zip code format',
          details: { providedZip: zipCode },
        } satisfies ZipCodeErrorResponse),
        {
          status: 400,
          headers: responseHeaders,
        }
      );
    }

    // Extract the 5-digit ZIP code if a 9-digit ZIP was provided
    const fiveDigitZip = parseInt(zipCode.slice(0, 5));

    let coordinates = null;
    let city = null;
    let state = null;

    // First, try to find the ZIP code in our database
    const { data: centers, error: dbError } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('postal_code', fiveDigitZip)
      .limit(1);

    if (dbError) {
      console.error('Database error during initial lookup:', dbError);
      // Continue to fallback if initial DB lookup fails
    }

    if (
      centers &&
      centers.length > 0 &&
      centers[0].latitude &&
      centers[0].longitude
    ) {
      const center = centers[0];
      city = center.city;
      state = center.state;
      coordinates = {
        lat: center.latitude,
        lng: center.longitude,
      };
      console.log(`Found coordinates in DB for ${fiveDigitZip}:`, coordinates);
    } else {
      console.log(
        `ZIP ${fiveDigitZip} not found in DB or missing coordinates, using Nominatim fallback.`
      );
      // If not found in database, use Nominatim's geocoding service as fallback
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${fiveDigitZip}&country=USA&format=json&addressdetails=1&limit=1`;

      try {
        const response = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'E-Waste-Directory/1.0',
          },
        });

        if (!response.ok) {
          console.error(
            'Nominatim service error:',
            response.status,
            response.statusText
          );
          return new Response(
            JSON.stringify({
              error: 'Zip code lookup service error',
              details: {
                status: response.status,
                statusText: response.statusText,
              },
            } satisfies ZipCodeErrorResponse),
            {
              status: 502,
              headers: responseHeaders,
            }
          );
        }

        const data = await response.json();

        if (data.length > 0) {
          const location = data[0];
          const address = location.address;

          // Try to get the city name from various address fields
          city =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.suburb;
          state = address.state;

          if (city && state) {
            coordinates = {
              lat: parseFloat(location.lat),
              lng: parseFloat(location.lon),
            };
            console.log(
              `Found coordinates via Nominatim for ${fiveDigitZip}:`,
              coordinates
            );

            // Optionally store the geocoded result in our database for future use
            // Check if an entry for this postal_code exists before inserting
            const { count } = await supabase
              .from('recycling_centers')
              .select('*', { count: 'exact', head: true })
              .eq('postal_code', fiveDigitZip);

            if (count === 0) {
              const { error: insertError } = await supabase
                .from('recycling_centers')
                .insert({
                  postal_code: fiveDigitZip,
                  city: city,
                  state: state,
                  latitude: coordinates.lat,
                  longitude: coordinates.lng,
                  name: `${city} Area`, // Generic name
                  description: 'Location data from geocoding service',
                });

              if (insertError) {
                console.error('Error storing geocoded data:', insertError);
              }
            } else {
              console.log(
                `Entry for postal_code ${fiveDigitZip} already exists, skipping insert.`
              );
            }
          } else {
            console.error(
              `Could not determine city or state for ${fiveDigitZip} via Nominatim.`
            );
          }
        }

        if (!coordinates) {
          console.error(
            `No coordinates found for ${fiveDigitZip} after Nominatim fallback.`
          );
          return new Response(
            JSON.stringify({
              error: 'Location not found or coordinates unavailable',
              details: { zipCode: fiveDigitZip },
            } satisfies ZipCodeErrorResponse),
            {
              status: 404,
              headers: responseHeaders,
            }
          );
        }
      } catch (nominatimError: any) {
        console.error('Error during Nominatim fetch:', nominatimError);
        return new Response(
          JSON.stringify({
            error: 'An error occurred during zip code lookup',
            details: { message: nominatimError.message },
          } satisfies ZipCodeErrorResponse),
          {
            status: 500,
            headers: responseHeaders,
          }
        );
      }
    }

    // If we have coordinates, find nearby recycling centers using the Supabase function
    if (coordinates) {
      const { data: nearbyCenters, error: rpcError } = await supabase.rpc(
        'find_nearby_recycling_centers',
        {
          target_latitude: coordinates.lat,
          target_longitude: coordinates.lng,
        }
      );

      if (rpcError) {
        console.error('Error calling Supabase RPC function:', rpcError);
        return new Response(
          JSON.stringify({
            error: 'Database query error',
            details: { message: rpcError.message },
          } satisfies ZipCodeErrorResponse),
          {
            status: 500,
            headers: responseHeaders,
          }
        );
      }

      // Return the found location info along with nearby centers
      return new Response(
        JSON.stringify({
          city: city || 'Unknown City', // Use fallback city if main lookup failed
          state: state || 'Unknown State', // Use fallback state
          coordinates: coordinates,
          nearby_centers: nearbyCenters || [],
        } satisfies ZipCodeResponse),
        {
          status: 200,
          headers: responseHeaders,
        }
      );
    } else {
      // This case should theoretically not be reached if coordinates check is correct, but as a safeguard:
      console.error(
        `Coordinates were null after all lookup attempts for ${fiveDigitZip}.`
      );
      return new Response(
        JSON.stringify({
          error: 'Could not determine location coordinates.',
          details: { zipCode: fiveDigitZip },
        } satisfies ZipCodeErrorResponse),
        {
          status: 500,
          headers: responseHeaders,
        }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred.',
        details: { message: error.message },
      } satisfies ZipCodeErrorResponse),
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }
};

export { handler as POST, handler as GET, handler as OPTIONS };
