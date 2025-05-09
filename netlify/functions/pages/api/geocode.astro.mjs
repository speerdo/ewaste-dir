export { renderers } from '../../renderers.mjs';

const prerender = false;
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const config = {
  runtime: "edge"
};
const handler = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    let lat = null;
    let lng = null;
    if (request.method === "GET") {
      const url = new URL(request.url);
      lat = url.searchParams.get("lat");
      lng = url.searchParams.get("lng");
    } else if (request.method === "POST") {
      const body = await request.json();
      lat = body.lat?.toString() ?? null;
      lng = body.lng?.toString() ?? null;
    } else {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
          details: { method: request.method }
        }),
        {
          status: 405,
          headers: corsHeaders
        }
      );
    }
    if (lat == null || lng == null) {
      return new Response(
        JSON.stringify({
          error: "Missing coordinates",
          details: {
            method: request.method,
            providedLat: lat,
            providedLng: lng
          }
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return new Response(
        JSON.stringify({
          error: "Invalid coordinates format",
          details: {
            providedLat: lat,
            providedLng: lng,
            parsedLat,
            parsedLng
          }
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return new Response(
        JSON.stringify({
          error: "Coordinates out of valid range",
          details: { parsedLat, parsedLng }
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parsedLat.toFixed(
      6
    )}&lon=${parsedLng.toFixed(6)}&zoom=18&addressdetails=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "Astro-Geocoding-Service/1.0"
      }
    });
    if (!response.ok) {
      console.error("Nominatim error:", response.status, response.statusText);
      return new Response(
        JSON.stringify({
          error: "Geocoding service error",
          details: {
            status: response.status,
            statusText: response.statusText
          }
        }),
        {
          status: 502,
          headers: corsHeaders
        }
      );
    }
    const data = await response.json();
    if (!data.address) {
      return new Response(
        JSON.stringify({
          error: "No address found",
          details: data
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }
    const city = data.address.city || data.address.town || data.address.village;
    const state = data.address.state;
    if (!city || !state) {
      return new Response(
        JSON.stringify({
          error: "Location not found",
          details: data.address
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }
    const geocodeResult = {
      city,
      state,
      coordinates: { lat: parsedLat, lng: parsedLng }
    };
    return new Response(JSON.stringify(geocodeResult), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error("Geocoding error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: {
          message: error instanceof Error ? error.message : String(error)
        }
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
};
const POST = handler;
const post = handler;
const GET = handler;
const get = handler;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST,
  config,
  default: handler,
  get,
  post,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
