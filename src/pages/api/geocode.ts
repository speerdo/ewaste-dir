import type { APIRoute } from 'astro';

export type GeocodeResponse = {
  city: string;
  state: string;
  display: string;
  raw_address: Record<string, any>;
  coordinates: {
    lat: number;
    lng: number;
  };
};

export type GeocodeErrorResponse = {
  error: string;
  message?: string;
  details?: Record<string, any>;
};

export const GET: APIRoute = async ({ url }): Promise<Response> => {
  const rawLat = url.searchParams.get('lat');
  const rawLng = url.searchParams.get('lng');

  console.log('Received raw coordinates:', {
    rawLat,
    rawLng,
    rawLatType: typeof rawLat,
    rawLngType: typeof rawLng,
    rawLatNull: rawLat === null,
    rawLngNull: rawLng === null,
    rawLatNullStr: rawLat === 'null',
    rawLngNullStr: rawLng === 'null',
  });

  // Handle missing or empty coordinates
  if (!rawLat || !rawLng || rawLat === 'null' || rawLng === 'null') {
    console.log('Coordinate validation failed:', {
      rawLatFalsy: !rawLat,
      rawLngFalsy: !rawLng,
      rawLatNullStr: rawLat === 'null',
      rawLngNullStr: rawLng === 'null',
    });

    return new Response(
      JSON.stringify({
        error: 'Missing or invalid coordinates',
        details: {
          rawLat,
          rawLng,
          reason: 'Coordinates must be provided and cannot be null',
          validationChecks: {
            rawLatFalsy: !rawLat,
            rawLngFalsy: !rawLng,
            rawLatNullStr: rawLat === 'null',
            rawLngNullStr: rawLng === 'null',
          },
        },
      } satisfies GeocodeErrorResponse),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  // Parse coordinates, handling potential scientific notation
  let lat: number, lng: number;

  try {
    lat = typeof rawLat === 'string' ? Number(rawLat) : rawLat;
    lng = typeof rawLng === 'string' ? Number(rawLng) : rawLng;
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to parse coordinates',
        details: {
          rawLat,
          rawLng,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      } satisfies GeocodeErrorResponse),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  console.log('Parsed coordinates:', { lat, lng });

  // Validate coordinates
  if (isNaN(lat) || isNaN(lng)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid coordinates format',
        details: {
          rawLat,
          rawLng,
          parsedLat: lat,
          parsedLng: lng,
          reason: 'Coordinates must be valid numbers',
        },
      } satisfies GeocodeErrorResponse),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  // Validate coordinate ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return new Response(
      JSON.stringify({
        error: 'Coordinates out of valid range',
        details: {
          lat,
          lng,
          reason:
            'Latitude must be between -90 and 90, longitude between -180 and 180',
        },
      } satisfies GeocodeErrorResponse),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  try {
    // Use OpenStreetMap's Nominatim service for geocoding
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(
      6
    )}&lon=${lng.toFixed(6)}&zoom=18&addressdetails=1`;
    console.log('Calling Nominatim:', nominatimUrl);

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'E-Waste Recycling Directory/1.0',
      },
    });

    if (!response.ok) {
      console.error('Nominatim error:', response.status, response.statusText);
      throw new Error(
        `Geocoding service error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log('Nominatim response:', data);

    // Extract city and state from the response
    const address = data.address;

    // Try multiple fields for city name
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.suburb ||
      address.municipality ||
      address.district;

    // Try multiple fields for state name
    const state = address.state || address.province || address.region;

    console.log('Extracted location:', { city, state, address });

    if (!city || !state) {
      return new Response(
        JSON.stringify({
          error: 'Could not determine city and state from your location',
          details: {
            foundCity: !!city,
            foundState: !!state,
            address: address,
            coordinates: { lat, lng },
          },
        } satisfies GeocodeErrorResponse),
        {
          status: 422,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        city,
        state,
        display: `${city}, ${state}`,
        raw_address: address,
        coordinates: { lat, lng },
      } satisfies GeocodeResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({
        error: 'Geocoding failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          coordinates: { lat, lng },
        },
      } satisfies GeocodeErrorResponse),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
};
