/* empty css                                    */
import { c as createAstro, a as createComponent, m as maybeRenderHead, r as renderTemplate, b as renderComponent, e as addAttribute } from '../../chunks/astro/server_BBuoheSG.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../../chunks/Layout_CWDkWl7g.mjs';
import 'clsx';
import { d as getRecyclingCentersByState, b as getState } from '../../chunks/cityData_BBNtT0tu.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro$2 = createAstro("https://www.recycleoldtech.com");
const $$StateDescription = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$StateDescription;
  const { state } = Astro2.props;
  console.log("StateDescription component - state data:", state);
  return renderTemplate`${maybeRenderHead()}<section class="bg-white py-12 border-b border-gray-100"> <div class="container mx-auto px-4"> <div class="mx-auto"> <h2 class="text-2xl font-display font-bold text-gray-900 mb-6">
E-Waste Recycling Laws and Programs in ${state.name} </h2> <div class="max-w-none"> ${state.description ? renderTemplate`<p class="text-gray-600 leading-relaxed"> ${state.description} </p>` : renderTemplate`<p class="text-gray-600 leading-relaxed">
Find electronics recycling centers in ${state.name}. Safe and responsible disposal of computers, phones, TVs and other electronic devices.
</p>`} </div> </div> </div> </section>`;
}, "/home/adam/Projects/ewaste-dir/src/components/StateDescription.astro", void 0);

const $$Astro$1 = createAstro("https://www.recycleoldtech.com");
const $$StateLayout = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$StateLayout;
  const { state, cityData, description, ogImage } = Astro2.props;
  let centersByCity = {};
  try {
    centersByCity = await getRecyclingCentersByState(state.id);
  } catch (error) {
    console.error("Error fetching recycling centers:", error);
    centersByCity = {};
  }
  const centers24_7 = Object.values(centersByCity).flat().filter(
    (center) => center.working_hours && typeof center.working_hours === "string" && center.working_hours.includes("24/7")
  ).length;
  const totalCenters = Object.values(centersByCity).reduce((acc, centers) => acc + centers.length, 0);
  const citiesWithCounts = Object.entries(centersByCity).map(([cityName, centers]) => ({
    id: cityName.toLowerCase().replace(/\s+/g, "-"),
    name: cityName,
    centerCount: centers.length,
    description: `Find electronics recycling centers in ${cityName}, ${state.name}. Safe and responsible disposal of computers, phones, TVs and other electronic devices.`
  })).sort((a, b) => a.name.localeCompare(b.name));
  const defaultStateImage = "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80";
  const metaDescription = description || `Find electronics recycling centers in ${state.name}. Safe and responsible disposal of computers, phones, TVs and other electronic devices.`;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": `Electronics Recycling in ${state.name} \u2013 E\u2011Waste Directory`, "description": metaDescription, "ogImage": ogImage }, { "default": async ($$result2) => renderTemplate`  ${maybeRenderHead()}<div class="pt-16"> <!-- Added padding to account for fixed header --> <!-- Hero Image --> <div class="relative h-[400px] overflow-hidden"> <img${addAttribute(state.image_url || defaultStateImage, "src")}${addAttribute(`Electronics recycling in ${state.name}`, "alt")} class="w-full h-full object-cover"> <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div> <!-- Hero Content --> <div class="absolute bottom-0 left-0 right-0 text-white"> <div class="container mx-auto px-4"> <!-- Breadcrumb --> <nav class="mb-4" aria-label="Breadcrumb"> <ol class="flex items-center space-x-2"> <li> <a href="/" class="text-gray-300 hover:text-white transition-colors">Home</a> </li> <li class="flex items-center"> <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path> </svg> <span class="text-white font-medium ml-2">${state.name}</span> </li> </ol> </nav> <h1 class="text-4xl font-display font-bold mb-4">Electronics Recycling in ${state.name}</h1> <p class="text-xl mb-6"> ${totalCenters} recycling ${totalCenters === 1 ? "center" : "centers"} in ${citiesWithCounts.length} ${citiesWithCounts.length === 1 ? "city" : "cities"} ${centers24_7 > 0 && ` \u2022 ${centers24_7} open 24/7`} </p> </div> </div> </div> </div>  ${renderComponent($$result2, "StateDescription", $$StateDescription, { "state": state })}  <div class="container mx-auto px-4 py-12"> <div class="max-w-7xl mx-auto"> <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"> ${citiesWithCounts.map((city) => renderTemplate`<a${addAttribute(`/states/${state.id}/${city.id}`, "href")} class="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100"> <div class="flex items-center justify-between"> <div> <h2 class="text-2xl font-display font-bold text-gray-900 mb-2">${city.name}</h2> <p class="text-gray-600">${city.centerCount} recycling ${city.centerCount === 1 ? "center" : "centers"}</p> </div> <div class="text-green-600"> <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path> </svg> </div> </div> </a>`)} </div> </div> </div>  ${state.nearby_states && state.nearby_states.length > 0 && renderTemplate`<div class="bg-gray-50 py-12"> <div class="container mx-auto px-4"> <h2 class="text-2xl font-display font-bold text-gray-900 mb-8">Nearby States</h2> <div class="grid grid-cols-1 md:grid-cols-3 gap-6"> ${await Promise.all(Object.values(state.nearby_states).slice(0, 3).map(async (nearbyState) => {
    const relatedState = await getState(nearbyState);
    if (!relatedState) return null;
    return renderTemplate`<a${addAttribute(`/states/${relatedState.id}`, "href")} class="group"> <div class="bg-white rounded-lg shadow-md overflow-hidden transition-shadow group-hover:shadow-lg"> <div class="h-40 overflow-hidden"> <img${addAttribute(relatedState.image_url || defaultStateImage, "src")}${addAttribute(relatedState.name, "alt")} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"> </div> <div class="p-4"> <h3 class="text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors">${relatedState.name}</h3> <p class="text-sm text-gray-600 line-clamp-2">${relatedState.description}</p> </div> </div> </a>`;
  }))} </div> </div> </div>`}` })}`;
}, "/home/adam/Projects/ewaste-dir/src/layouts/StateLayout.astro", void 0);

const $$Astro = createAstro("https://www.recycleoldtech.com");
const prerender = false;
const $$state = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$state;
  Astro2.response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  Astro2.response.headers.set("CDN-Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  const { state: stateParam } = Astro2.params;
  if (!stateParam) {
    return Astro2.redirect("/404");
  }
  const state = await getState(stateParam);
  if (!state) {
    return Astro2.redirect("/404");
  }
  const centersByCity = await getRecyclingCentersByState(state.id);
  const sortedCities = Object.keys(centersByCity).sort();
  const totalCenters = Object.values(centersByCity).reduce((sum, centers) => sum + centers.length, 0);
  const PRODUCTION_URL = "https://www.recycleoldtech.com";
  const ogImageUrl = new URL("/images/default-og.png", PRODUCTION_URL).toString() ;
  const cityData = sortedCities.map((city) => {
    const centers = centersByCity[city];
    const firstCenter = centers[0];
    return {
      id: city.toLowerCase().replace(/\s+/g, "-"),
      name: city,
      description: `Find electronics recycling centers in ${city}, ${state.name}. Safe and responsible disposal of computers, phones, TVs and other electronic devices.`,
      address: firstCenter.full_address,
      coordinates: {
        lat: firstCenter.latitude,
        lng: firstCenter.longitude
      }
    };
  });
  const description = `Find ${totalCenters} electronics recycling ${totalCenters === 1 ? "center" : "centers"} in ${state.name}. Get directions and information for safe disposal of computers, phones, TVs and other electronic devices.`;
  return renderTemplate`${renderComponent($$result, "StateLayout", $$StateLayout, { "state": state, "cityData": cityData, "description": description, "ogImage": ogImageUrl })}`;
}, "/home/adam/Projects/ewaste-dir/src/pages/states/[state].astro", void 0);
const $$file = "/home/adam/Projects/ewaste-dir/src/pages/states/[state].astro";
const $$url = "/states/[state]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$state,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
