// src/pages/api/zipfind.js - Serverside ZIP code lookup with database integration
import { createClient } from '@supabase/supabase-js';

// Configure the runtime for Vercel
export const config = {
  runtime: 'edge',
  regions: ['iad1'], // Use a consistent region for stability
  cache: 'no-store', // Completely disable caching at the edge
  maxDuration: 15, // Increase the timeout to 15 seconds
};

// Initialize API handlers
let GET, POST, OPTIONS;

// Initialize Supabase client with proper configuration for the edge runtime
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

// Handle edge case if env vars aren't available in the edge runtime context
try {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase credentials. Make sure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.'
    );
  }

  // Initialize Supabase client with settings for edge functions
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Don't persist auth state in serverless
    },
    global: {
      headers: { 'x-client-info': 'ewaste-dir-api' },
    },
  });

  // Simple API endpoint with extreme cache prevention
  GET = async (context) => {
    const startTime = Date.now();
    const { request } = context;
    const url = new URL(request.url);
    const zipCode = url.searchParams.get('zip');
    const requestId = `req_${startTime}_${Math.floor(Math.random() * 10000)}`;

    // Setup structured logging
    const log = (message, data = {}) => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          requestId,
          message,
          ...data,
        })
      );
    };

    // Log request start
    log(`Processing ZIP lookup request for ${zipCode || 'unknown'}`, {
      url: request.url,
      method: request.method,
    });

    // Create response object to return
    const headers = new Headers();

    // Allow CORS
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Accept, X-Requested-With'
    );
    headers.set('Access-Control-Max-Age', '86400');

    // Set most aggressive anti-cache headers possible
    headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
    );
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    headers.set('Surrogate-Control', 'no-store');

    // Vercel-specific cache headers
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Vercel-CDN-Cache-Control', 'no-store');
    headers.set('X-Vercel-Cache', 'BYPASS');
    headers.set('X-Vercel-Skip-Cache', 'true');
    headers.set('Edge-Control', 'no-store');
    headers.set('X-Middleware-Cache', 'no-cache');

    // Set Vary header to all to prevent cache sharing
    headers.set('Vary', '*');

    // Add content type for JSON response
    headers.set('Content-Type', 'application/json');

    // Set function timeouts to prevent Vercel serverless timeouts
    const TIMEOUT_DIRECT_LOOKUP = 2000; // 2 seconds
    const TIMEOUT_GEOCODING = 3000; // 3 seconds
    const TIMEOUT_CENTERS_LOOKUP = 3000; // 3 seconds
    const TIMEOUT_FALLBACK = 1000; // 1 second
    const TIMEOUT_TOTAL = 8000; // 8 seconds total max

    // Create a total timeout to avoid Vercel 10s limit
    const totalTimeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Total processing timeout')),
        TIMEOUT_TOTAL
      );
    });

    // Handle the request
    try {
      if (!zipCode) {
        log('Missing ZIP code parameter');
        return new Response(
          JSON.stringify({
            error: 'Missing ZIP code',
            timestamp: new Date().toISOString(),
            requestId,
            nocache: `${startTime}_${Math.random().toString(36).substring(2)}`,
          }),
          {
            status: 400,
            headers,
          }
        );
      }

      // Clean up the ZIP code - make sure it's just digits
      const cleanZip = zipCode.toString().replace(/\D/g, '');
      log(`Cleaned ZIP code: ${cleanZip}`);

      // Wrap the entire process in a race with the total timeout
      const result = await Promise.race([
        processZipCode(cleanZip, requestId, log, {
          TIMEOUT_DIRECT_LOOKUP,
          TIMEOUT_GEOCODING,
          TIMEOUT_CENTERS_LOOKUP,
          TIMEOUT_FALLBACK,
        }),
        totalTimeoutPromise,
      ]);

      // Calculate processing time
      const processingTime = Date.now() - startTime;
      log(`ZIP code processing completed in ${processingTime}ms`, {
        result: result ? Object.keys(result) : null,
        source: result?.source,
        processingTime,
      });

      // Add processing metadata to the response
      const response = {
        ...result,
        processingTime,
        timestamp: new Date().toISOString(),
        requestId,
        nocache: `${startTime}_${Math.random().toString(36).substring(2)}`,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      log(`Error processing request: ${error.message}`, {
        error: error.stack,
        processingTime,
      });

      // Try to get a fallback result if the error was a timeout
      let fallbackResult = null;
      if (error.message.includes('timeout')) {
        try {
          fallbackResult = await getFallbackCity(cleanZip, requestId, log);
        } catch (fallbackError) {
          log(`Fallback also failed: ${fallbackError.message}`);
        }
      }

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error.message || 'Unknown error',
          fallback: fallbackResult,
          timestamp: new Date().toISOString(),
          requestId,
          processingTime,
          nocache: `${startTime}_${Math.random().toString(36).substring(2)}`,
        }),
        {
          status: fallbackResult ? 200 : 500,
          headers,
        }
      );
    }
  };

  // Handle OPTIONS request for CORS
  OPTIONS = async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Accept, X-Requested-With, X-No-Cache',
        'Access-Control-Max-Age': '86400',
      },
    });
  };

  // Also add POST handler for backward compatibility
  POST = async (context) => {
    const { request } = context;
    let zipCode;

    try {
      const body = await request.json();
      zipCode = body?.zip;
    } catch (e) {
      // If JSON parse fails, try reading as form data
      try {
        const formData = await request.formData();
        zipCode = formData.get('zip');
      } catch (formError) {
        zipCode = null;
      }
    }

    // Create a new URL with the zip as query parameter
    const url = new URL(request.url);
    if (zipCode) {
      url.searchParams.set('zip', zipCode);
    }

    // Create a new request with the updated URL
    const newRequest = new Request(url, {
      method: 'GET',
      headers: request.headers,
    });

    // Reuse the GET handler
    return GET({ request: newRequest });
  };

  // Process a ZIP code with internal timeouts to avoid Vercel serverless timeouts
  async function processZipCode(cleanZip, requestId, log, timeouts) {
    // STEP 1: First check our database for the exact ZIP code match (with timeout)
    log(`Looking up ZIP code ${cleanZip} in database`);

    try {
      const directLookupPromise = supabase
        .from('recycling_centers')
        .select('city, state, latitude, longitude')
        .or(
          `postal_code.eq.${parseInt(cleanZip, 10)},postal_code.eq.${cleanZip}`
        )
        .not('city', 'is', null)
        .not('state', 'is', null)
        .limit(1);

      const directLookupTimeout = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Direct lookup timeout')),
          timeouts.TIMEOUT_DIRECT_LOOKUP
        );
      });

      const { data: zipData, error: zipError } = await Promise.race([
        directLookupPromise,
        directLookupTimeout,
      ]);

      if (zipError) {
        log(`Database error: ${zipError.message}`);
      } else if (
        zipData &&
        zipData.length > 0 &&
        zipData[0].city &&
        zipData[0].state
      ) {
        const center = zipData[0];
        log(`Found direct match: ${center.city}, ${center.state}`);

        // Format the state and city for URL
        const formattedState = center.state.toLowerCase().replace(/\s+/g, '-');
        const formattedCity = center.city.toLowerCase().replace(/\s+/g, '-');
        const url = `/states/${formattedState}/${formattedCity}`;

        return {
          city: center.city,
          state: center.state,
          coordinates:
            center.latitude && center.longitude
              ? {
                  lat: parseFloat(center.latitude),
                  lng: parseFloat(center.longitude),
                }
              : null,
          url,
          source: 'database-direct-match',
          requestedZip: cleanZip,
        };
      }
    } catch (directLookupError) {
      log(`Direct lookup failed: ${directLookupError.message}`);
      // Continue to next strategy
    }

    // STEP 2: Try to get coordinates for this ZIP code (with timeout)
    log(`Getting coordinates for ZIP ${cleanZip}`);
    let coordinates = null;

    try {
      coordinates = await Promise.race([
        getCoordinatesForZip(cleanZip, log),
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('Geocoding timeout')),
            timeouts.TIMEOUT_GEOCODING
          );
        }),
      ]);

      if (coordinates) {
        log(`Found coordinates: ${coordinates.lat}, ${coordinates.lng}`);
      } else {
        log(`No coordinates found for ZIP ${cleanZip}`);
      }
    } catch (geocodingError) {
      log(`Geocoding failed: ${geocodingError.message}`);
    }

    // STEP 3: If we have coordinates, find closest recycling center (with timeout)
    if (coordinates) {
      try {
        const closestCenterPromise = findClosestRecyclingCenter(
          coordinates,
          log
        );
        const closestCenterTimeout = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('Centers lookup timeout')),
            timeouts.TIMEOUT_CENTERS_LOOKUP
          );
        });

        const closestCenter = await Promise.race([
          closestCenterPromise,
          closestCenterTimeout,
        ]);

        if (closestCenter) {
          log(
            `Found closest center: ${closestCenter.city}, ${closestCenter.state}`
          );
          return closestCenter;
        }
      } catch (centersError) {
        log(`Finding closest center failed: ${centersError.message}`);
      }
    }

    // STEP 4: Get fallback city as last resort
    log(`Getting fallback city for ZIP ${cleanZip}`);
    return getFallbackCity(cleanZip, requestId, log);
  }

  // Get coordinates for a ZIP code using multiple services
  async function getCoordinatesForZip(zipCode, log) {
    // First try Census.gov API
    try {
      log(`Trying Census.gov API for ZIP ${zipCode}`);
      const url = `https://geocoding.geo.census.gov/geocoder/locations/address?zip=${zipCode}&benchmark=Public_AR_Current&format=json`;
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const result = await response.json();

      if (
        result.result?.addressMatches?.length > 0 &&
        result.result.addressMatches[0].coordinates
      ) {
        const coords = result.result.addressMatches[0].coordinates;
        return {
          lat: coords.y,
          lng: coords.x,
          source: 'census.gov',
        };
      }
    } catch (censusError) {
      log(`Census.gov API error: ${censusError.message}`);
    }

    // Then try OpenStreetMap
    try {
      log(`Trying OpenStreetMap for ZIP ${zipCode}`);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=USA&format=json`;
      const nominatimResponse = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Astro-Geocoding-Service/1.0',
        },
        signal: AbortSignal.timeout(2000),
      });
      const nominatimData = await nominatimResponse.json();

      if (nominatimData && nominatimData.length > 0) {
        return {
          lat: parseFloat(nominatimData[0].lat),
          lng: parseFloat(nominatimData[0].lon),
          source: 'openstreetmap',
        };
      }
    } catch (osmError) {
      log(`OpenStreetMap API error: ${osmError.message}`);
    }

    return null;
  }

  // Find the closest recycling center to given coordinates
  async function findClosestRecyclingCenter(coordinates, log) {
    log(
      `Finding closest recycling center for coordinates: ${coordinates.lat}, ${coordinates.lng}`
    );

    const { data: centers, error: centersError } = await supabase
      .from('recycling_centers')
      .select('id, city, state, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(300); // Limit to avoid timeout

    if (centersError) {
      log(`Error querying recycling centers: ${centersError.message}`);
      throw centersError;
    }

    if (!centers || centers.length === 0) {
      log('No recycling centers with coordinates found');
      return null;
    }

    log(`Found ${centers.length} recycling centers with coordinates`);

    // Find the closest center
    let closestCenter = null;
    let closestDistance = Number.MAX_VALUE;

    for (const center of centers) {
      if (!center.latitude || !center.longitude) continue;

      const centerCoords = {
        lat: parseFloat(center.latitude),
        lng: parseFloat(center.longitude),
      };

      // Calculate distance
      const distance = calculateDistance(coordinates, centerCoords);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestCenter = center;
      }
    }

    if (closestCenter) {
      log(
        `Found closest center: ${closestCenter.city}, ${
          closestCenter.state
        } (${closestDistance.toFixed(2)}km)`
      );

      // Format for URL
      const formattedState = closestCenter.state
        .toLowerCase()
        .replace(/\s+/g, '-');
      const formattedCity = closestCenter.city
        .toLowerCase()
        .replace(/\s+/g, '-');
      const url = `/states/${formattedState}/${formattedCity}`;

      return {
        city: closestCenter.city,
        state: closestCenter.state,
        coordinates: {
          lat: parseFloat(closestCenter.latitude),
          lng: parseFloat(closestCenter.longitude),
        },
        url,
        source: 'closest-recycling-center',
        distance: closestDistance,
      };
    }

    return null;
  }

  // Get any city as a fallback
  async function getFallbackCity(zipCode, requestId, log) {
    log(`Getting fallback city for ZIP ${zipCode}`);

    try {
      const { data: fallbackCenters, error: fallbackError } = await supabase
        .from('recycling_centers')
        .select('city, state, latitude, longitude')
        .not('city', 'is', null)
        .not('state', 'is', null)
        .limit(10);

      if (fallbackError) {
        log(`Fallback query error: ${fallbackError.message}`);
        throw fallbackError;
      }

      if (fallbackCenters && fallbackCenters.length > 0) {
        // Just pick a random one as fallback
        const randomIndex = Math.floor(Math.random() * fallbackCenters.length);
        const fallbackCenter = fallbackCenters[randomIndex];

        log(`Using fallback: ${fallbackCenter.city}, ${fallbackCenter.state}`);

        // Format for URL
        const formattedState = fallbackCenter.state
          .toLowerCase()
          .replace(/\s+/g, '-');
        const formattedCity = fallbackCenter.city
          .toLowerCase()
          .replace(/\s+/g, '-');
        const url = `/states/${formattedState}/${formattedCity}`;

        return {
          city: fallbackCenter.city,
          state: fallbackCenter.state,
          coordinates:
            fallbackCenter.latitude && fallbackCenter.longitude
              ? {
                  lat: parseFloat(fallbackCenter.latitude),
                  lng: parseFloat(fallbackCenter.longitude),
                }
              : null,
          url,
          source: 'fallback-random-city',
          requestedZip: zipCode,
        };
      }

      // Absolute last resort - this should never happen in practice
      log('No fallback centers found, using hardcoded fallback');
      return {
        city: 'Error',
        state: 'Contact Support',
        source: 'error-fallback',
        url: '/',
        requestedZip: zipCode,
      };
    } catch (error) {
      log(`Fallback error: ${error.message}`);
      // Last resort fallback that doesn't rely on database
      return {
        city: 'Error',
        state: 'Contact Support',
        source: 'error-fallback',
        url: '/',
        requestedZip: zipCode,
      };
    }
  }

  // Calculate distance between two coordinate points
  function calculateDistance(point1, point2) {
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
} catch (error) {
  console.error('Error initializing Supabase client:', error);

  // Create an error handler that doesn't depend on Supabase
  const errorHandler = async (request) => {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(
      JSON.stringify({
        error: 'Database configuration error',
        message: 'The API is not properly configured. Please contact support.',
        timestamp: new Date().toISOString(),
        nocache: `${Date.now()}_${Math.random().toString(36).substring(2)}`,
      }),
      {
        status: 500,
        headers,
      }
    );
  };

  // Set handlers to error handler
  GET = errorHandler;
  POST = errorHandler;
  OPTIONS = async () =>
    new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Accept, X-Requested-With',
      },
    });
}

// Export handlers
export { GET, POST, OPTIONS };
