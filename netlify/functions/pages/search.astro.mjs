/* empty css                                 */
import { c as createAstro, a as createComponent, b as renderComponent, r as renderTemplate, m as maybeRenderHead, f as renderScript, e as addAttribute } from '../chunks/astro/server_BBuoheSG.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_CWDkWl7g.mjs';
import { s as supabase } from '../chunks/cityData_BBNtT0tu.mjs';
import { $ as $$MapComponent } from '../chunks/MapComponent_B-LZNU0Y.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro("https://www.recycleoldtech.com");
const $$Search = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Search;
  const query = Astro2.url.searchParams.get("q")?.toLowerCase().trim() || "";
  const { data: centers = [] } = await supabase.from("recycling_centers").select("*").or(`
    name.ilike.%${query}%,
    city.ilike.%${query}%,
    state.ilike.%${query}%,
    full_address.ilike.%${query}%,
    zip.ilike.%${query}%,
    name.ilike.${query}%,
    city.ilike.${query}%,
    state.ilike.${query}%
  `).not("city", "is", null).not("state", "is", null).order("state", { ascending: true }).order("city", { ascending: true }).limit(100);
  const mapMarkers = (centers || []).map((center) => ({
    lat: Number(center.latitude),
    lng: Number(center.longitude),
    name: center.name,
    address: center.full_address,
    phone: center.phone,
    website: center.site,
    id: center.id
  })).filter((marker) => !isNaN(marker.lat) && !isNaN(marker.lng));
  const centersByLocation = (centers || []).reduce((acc, center) => {
    const state = center.state || "Unknown State";
    const city = center.city || "Unknown City";
    if (!acc[state]) {
      acc[state] = {};
    }
    if (!acc[state][city]) {
      acc[state][city] = [];
    }
    acc[state][city].push(center);
    return acc;
  }, {});
  const totalCenters = centers?.length || 0;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": `Search Results for "${query}" | E-Waste Recycling Centers` }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="bg-white min-h-screen"> <div class="container mx-auto px-4 py-8"> <h1 class="text-4xl font-display font-bold text-gray-900 mb-4">
Search Results for "${query}"
</h1> <p class="text-xl text-gray-600 mb-8">
Found ${totalCenters} recycling ${totalCenters === 1 ? "center" : "centers"} </p> <div class="grid grid-cols-1 lg:grid-cols-2 gap-8"> <!-- Map Section --> <div class="rounded-xl overflow-hidden shadow-lg h-[600px] lg:sticky lg:top-4"> ${mapMarkers.length > 0 ? renderTemplate`${renderComponent($$result2, "MapComponent", $$MapComponent, { "markers": mapMarkers, "initialZoom": 4 })}` : renderTemplate`<div class="w-full h-full flex items-center justify-center bg-gray-100"> <p class="text-gray-500">No locations found</p> </div>`} </div> <!-- Results List --> <div class="space-y-8"> ${Object.entries(centersByLocation).map(([state, cities]) => renderTemplate`<div class="space-y-6"> <h2 class="text-2xl font-bold text-gray-900">${state}</h2> ${Object.entries(cities).map(([city, cityResults]) => renderTemplate`<div class="space-y-4"> <h3 class="text-xl font-semibold text-gray-800">${city}</h3> <div class="space-y-4"> ${cityResults.map((center) => renderTemplate`<div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all"> <div class="p-6"> <h4 class="text-lg font-bold text-gray-900 mb-2"> ${center.name} </h4> <div class="space-y-3 text-gray-600"> ${center.full_address && renderTemplate`<div class="flex items-start"> <svg class="w-6 h-6 text-gray-400 mr-3 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path> </svg> <span>${center.full_address}</span> </div>`} ${center.phone && renderTemplate`<div class="flex items-center"> <svg class="w-6 h-6 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path> </svg> <a${addAttribute(`tel:${center.phone}`, "href")} class="hover:text-green-600"> ${center.phone} </a> </div>`} ${center.site && renderTemplate`<div class="flex items-center"> <svg class="w-6 h-6 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path> </svg> <a${addAttribute(center.site, "href")} target="_blank" rel="noopener noreferrer" class="text-green-600 hover:text-green-700">
Visit Website
</a> </div>`} </div> <div class="mt-4 flex flex-wrap gap-2"> <button${addAttribute(`showDirections(${center.latitude}, ${center.longitude})`, "onclick")} class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
Get Directions
</button> </div> </div> </div>`)} </div> </div>`)} </div>`)} ${totalCenters === 0 && renderTemplate`<div class="text-center py-12"> <p class="text-gray-500">No recycling centers found matching your search.</p> <p class="text-gray-500 mt-2">Try searching for a different city or state.</p> </div>`} </div> </div> </div> </div> ${renderScript($$result2, "/home/adam/Projects/ewaste-dir/src/pages/search.astro?astro&type=script&index=0&lang.ts")} ` })}`;
}, "/home/adam/Projects/ewaste-dir/src/pages/search.astro", void 0);

const $$file = "/home/adam/Projects/ewaste-dir/src/pages/search.astro";
const $$url = "/search";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Search,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
