import { g as getAllCityStatePairs, a as searchLocations } from '../../../chunks/cityData_BBNtT0tu.mjs';
export { renderers } from '../../../renderers.mjs';

const GET = async ({ url }) => {
  try {
    const query = url.searchParams.get("q")?.toLowerCase().trim() || "";
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const cityStatePairs = await getAllCityStatePairs();
    const suggestions = searchLocations(query, cityStatePairs);
    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Search suggestions error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get search suggestions",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
