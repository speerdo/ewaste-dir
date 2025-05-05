import type { APIRoute } from 'astro';

interface ZipCodeResponse {
  city: string;
  state: string;
  error?: string;
}

export const GET: APIRoute = async ({ url }): Promise<Response> => {
  try {
    const zipCode = url.searchParams.get('zip');

    if (!zipCode || !/^\d{5}(-\d{4})?$/.test(zipCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid zip code format' }),
        { status: 400 }
      );
    }

    // Use the Census Bureau API to get city and state from zip code
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/geographies/address?street=1&zip=${zipCode}&benchmark=2020&vintage=2020&format=json`;

    const response = await fetch(censusUrl);
    const data = await response.json();

    if (!response.ok) {
      throw new Error('Census API request failed');
    }

    const result =
      data?.result?.addressMatches?.[0]?.geographies?.[
        '2020 Census Blocks'
      ]?.[0];

    if (!result) {
      return new Response(JSON.stringify({ error: 'Location not found' }), {
        status: 404,
      });
    }

    // Extract city (place) and state information
    const state = result.STATE;
    const city = result.PLACE || result.COUNTY;

    if (!city || !state) {
      return new Response(
        JSON.stringify({ error: 'Location data incomplete' }),
        { status: 404 }
      );
    }

    const responseData: ZipCodeResponse = {
      city,
      state,
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Zip code lookup error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process zip code' }),
      { status: 500 }
    );
  }
};
