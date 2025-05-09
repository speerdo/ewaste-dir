import { g as getAllCityStatePairs, s as supabase } from '../../chunks/cityData_BBNtT0tu.mjs';
export { renderers } from '../../renderers.mjs';

const prerender = false;
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
};
const handler = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const cityStatePairs = await getAllCityStatePairs();
    const citiesWithCoordinates = [...cityStatePairs];
    const { data: cityCoordinates, error } = await supabase.from("recycling_centers").select("city, state, latitude, longitude").not("latitude", "is", null).not("longitude", "is", null);
    if (error) {
      console.error("Error fetching city coordinates:", error);
      return new Response(JSON.stringify(cityStatePairs), {
        status: 200,
        headers: corsHeaders
      });
    }
    const coordinatesMap = /* @__PURE__ */ new Map();
    cityCoordinates?.forEach((record) => {
      const key = `${record.city.toLowerCase()},${record.state.toLowerCase()}`;
      if (!coordinatesMap.has(key) && record.latitude && record.longitude) {
        coordinatesMap.set(key, {
          lat: record.latitude,
          lng: record.longitude
        });
      }
    });
    citiesWithCoordinates.forEach((cityData) => {
      const key = `${cityData.city.toLowerCase()},${cityData.state.toLowerCase()}`;
      const coordinates = coordinatesMap.get(key);
      if (coordinates) {
        cityData.coordinates = coordinates;
      }
    });
    return new Response(JSON.stringify(citiesWithCoordinates), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error("Error in cities-data API:", error);
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
const GET = handler;
const get = handler;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  default: handler,
  get,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
