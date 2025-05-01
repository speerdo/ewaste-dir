import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');

  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: 'Missing coordinates' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Use OpenStreetMap's Nominatim service for geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'E-Waste Recycling Directory/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding service error');
    }

    const data = await response.json();

    // Extract city and state from the response
    const address = data.address;
    const city =
      address.city || address.town || address.village || address.suburb;
    const state = address.state;

    return new Response(JSON.stringify({ city, state }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(JSON.stringify({ error: 'Geocoding failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
