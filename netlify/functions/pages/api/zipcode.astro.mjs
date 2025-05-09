export { renderers } from '../../renderers.mjs';

const prerender = false;
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};
const GET = async ({ request }) => {
  try {
    let zipCode = null;
    try {
      const url = new URL(request.url);
      zipCode = url.searchParams.get("zip");
    } catch (e) {
      console.error("Error parsing URL:", e);
    }
    if (!zipCode) {
      try {
        const url = new URL(request.url);
        const rawQuery = url.search.substring(1);
        if (rawQuery) {
          const params = new URLSearchParams(rawQuery);
          zipCode = params.get("zip");
        }
      } catch (e) {
        console.error("Error with raw query parsing:", e);
      }
    }
    if (!zipCode) {
      try {
        const match = request.url.match(/[?&]zip=([^&]+)/);
        if (match) {
          zipCode = decodeURIComponent(match[1]);
        }
      } catch (e) {
        console.error("Error with regex parsing:", e);
      }
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    if (request.method === "GET") {
    } else if (request.method === "POST") {
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
    if (!zipCode) {
      console.error("Missing zip code parameter");
      return new Response(
        JSON.stringify({
          error: "Missing zip code",
          details: {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers)
          }
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      console.error("Invalid zip code format:", zipCode);
      return new Response(
        JSON.stringify({
          error: "Invalid zip code format",
          details: { providedZip: zipCode }
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }
    const fiveDigitZip = zipCode.slice(0, 5);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${fiveDigitZip}&country=USA&format=json&addressdetails=1&limit=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "E-Waste-Directory/1.0"
      }
    });
    if (!response.ok) {
      console.error(
        "Nominatim API error:",
        response.status,
        response.statusText
      );
      return new Response(
        JSON.stringify({
          error: "Zip code lookup service error",
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
    if (!data.length) {
      console.error("No location data found in Nominatim API response");
      return new Response(
        JSON.stringify({
          error: "Location not found",
          details: { zipCode }
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }
    const location = data[0];
    const address = location.address;
    const city = address.city || address.town || address.village || address.municipality || address.suburb;
    const state = address.state;
    if (!city || !state) {
      console.error("Incomplete location data:", address);
      return new Response(
        JSON.stringify({
          error: "Incomplete location data",
          details: { address }
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }
    const zipCodeResult = {
      city,
      state,
      coordinates: {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lon)
      }
    };
    const responseHeaders = {
      ...corsHeaders,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "CDN-Cache-Control": "no-store"
    };
    return new Response(JSON.stringify(zipCodeResult), {
      status: 200,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("Zip code lookup error:", error);
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
const POST = async ({ request }) => {
  try {
    let zipCode = null;
    const requestNonce = Date.now().toString() + "-" + Math.random().toString(36).substring(2);
    try {
      const body = await request.json();
      const { _timestamp, ...actualBody } = body;
      console.log(`Processing zipcode request at ${(/* @__PURE__ */ new Date()).toISOString()}`, {
        zipCode: actualBody.zip,
        timestamp: _timestamp,
        nonce: requestNonce
      });
      zipCode = actualBody.zip?.toString() ?? null;
    } catch (error) {
      console.error("Error parsing POST request body:", error);
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: {
            message: error instanceof Error ? error.message : String(error)
          }
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }
    if (!zipCode) {
      console.error("Missing zip code parameter");
      return new Response(
        JSON.stringify({
          error: "Missing zip code",
          details: {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers)
          }
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      console.error("Invalid zip code format:", zipCode);
      return new Response(
        JSON.stringify({
          error: "Invalid zip code format",
          details: { providedZip: zipCode }
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }
    const fiveDigitZip = zipCode.slice(0, 5);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${fiveDigitZip}&country=USA&format=json&addressdetails=1&limit=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "E-Waste-Directory/1.0"
      }
    });
    if (!response.ok) {
      console.error(
        "Nominatim API error:",
        response.status,
        response.statusText
      );
      return new Response(
        JSON.stringify({
          error: "Zip code lookup service error",
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
    if (!data.length) {
      console.error("No location data found in Nominatim API response");
      return new Response(
        JSON.stringify({
          error: "Location not found",
          details: { zipCode }
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }
    const location = data[0];
    const address = location.address;
    const city = address.city || address.town || address.village || address.municipality || address.suburb;
    const state = address.state;
    if (!city || !state) {
      console.error("Incomplete location data:", address);
      return new Response(
        JSON.stringify({
          error: "Incomplete location data",
          details: { address }
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }
    const zipCodeResult = {
      city,
      state,
      coordinates: {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lon)
      }
    };
    const responseHeaders = {
      ...corsHeaders,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "CDN-Cache-Control": "no-store"
    };
    return new Response(JSON.stringify(zipCodeResult), {
      status: 200,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("Zip code lookup error:", error);
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
const post = POST;
const get = GET;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST,
  default: GET,
  get,
  post,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
