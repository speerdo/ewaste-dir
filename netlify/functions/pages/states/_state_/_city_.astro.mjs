/* empty css                                       */
import { c as createAstro, a as createComponent, m as maybeRenderHead, e as addAttribute, r as renderTemplate, f as renderScript, b as renderComponent, F as Fragment, d as defineScriptVars } from '../../../chunks/astro/server_BBuoheSG.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../../../chunks/Layout_CWDkWl7g.mjs';
import { b as getState, c as getRecyclingCentersByCity } from '../../../chunks/cityData_BBNtT0tu.mjs';
import { $ as $$MapComponent } from '../../../chunks/MapComponent_B-LZNU0Y.mjs';
import 'clsx';
export { renderers } from '../../../renderers.mjs';

const $$Astro$2 = createAstro("https://www.recycleoldtech.com");
const $$CenterCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$CenterCard;
  const { center, defaultLogo } = Astro2.props;
  function formatWorkingHours(hours) {
    if (!hours) return "Hours not available";
    if (typeof hours === "string") {
      if (hours === "24/7") return "Open 24/7";
      return hours;
    }
    try {
      let parsed = hours;
      if (typeof hours === "string") {
        parsed = JSON.parse(hours);
      }
      const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      return Object.entries(parsed).sort(([a], [b]) => daysOrder.indexOf(a) - daysOrder.indexOf(b)).map(([day, time]) => `${day}: ${time}`).join("\n");
    } catch (error) {
      console.error("Error parsing hours:", error);
      return hours.toString();
    }
  }
  return renderTemplate`${maybeRenderHead()}<div${addAttribute(`center-${center.id}`, "id")} class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"${addAttribute(center.id, "data-center-id")}${addAttribute(center.rating ? Number(center.rating).toFixed(1) : "0", "data-rating")}${addAttribute(center.latitude, "data-lat")}${addAttribute(center.longitude, "data-lng")}${addAttribute(`
    // Remove highlight from all centers
    document.querySelectorAll('[data-center-id]').forEach(el => el.classList.remove('highlight-center'));
    // Add highlight to this center
    this.classList.add('highlight-center');
    // Dispatch event for map marker
    window.dispatchEvent(new CustomEvent('markerClick', { detail: { centerId: '${center.id}' }}));
  `, "onclick")}> <div class="p-6"> <div class="flex items-start justify-between"> <div class="flex-grow"> <h2 class="text-2xl font-bold text-gray-900 mb-2"> ${center.name} </h2> ${center.rating && renderTemplate`<div class="flex items-center mb-2"> ${Array.from({ length: Math.round(Number(center.rating)) }).map(() => renderTemplate`<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"> <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path> </svg>`)} <span class="ml-2 text-gray-600"> ${Number(center.rating).toFixed(1)} (${center.reviews || 0} reviews)
</span> </div>`} </div> <div class="flex-shrink-0 ml-4"> ${center.logo ? renderTemplate`<img${addAttribute(center.logo, "src")}${addAttribute(`${center.name} logo`, "alt")} class="w-16 h-16 object-contain rounded-lg bg-gray-50"${addAttribute(`this.onerror=null; this.src='${defaultLogo}';`, "onerror")}>` : renderTemplate`<div class="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center"> <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path> </svg> </div>`} </div> </div> <div class="mt-4 space-y-3"> <div class="flex items-start"> <svg class="w-6 h-6 text-gray-400 mr-3 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path> </svg> <address class="not-italic text-gray-600"> ${center.full_address} </address> </div> ${center.phone && renderTemplate`<div class="flex items-center"> <svg class="w-6 h-6 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path> </svg> <a${addAttribute(`tel:${center.phone}`, "href")} class="text-green-600 hover:text-green-700"> ${center.phone} </a> </div>`} ${center.site && renderTemplate`<div class="flex items-center"> <svg class="w-6 h-6 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path> </svg> <a${addAttribute(center.site, "href")} target="_blank" rel="noopener noreferrer" class="text-green-600 hover:text-green-700">
Visit Website
</a> </div>`} ${center.description && renderTemplate`<div class="flex items-start"> <svg class="w-6 h-6 text-gray-400 mr-3 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path> </svg> <p class="text-gray-600">${center.description}</p> </div>`} ${center.working_hours && renderTemplate`<div class="flex items-start"> <svg class="w-6 h-6 text-gray-400 mr-3 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path> </svg> <div class="text-gray-600"> <button type="button" class="hours-toggle flex items-center gap-2 hover:text-green-600 transition-colors" onclick="this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'); document.getElementById(this.getAttribute('aria-controls')).style.display = this.getAttribute('aria-expanded') === 'true' ? 'block' : 'none'; this.querySelector('svg').classList.toggle('rotate-180')" aria-expanded="false"${addAttribute(`hours-${center.id}`, "aria-controls")} data-hours-toggle> <span>Opening Hours</span> <svg class="w-4 h-4 transform transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path> </svg> </button> <div${addAttribute(`hours-${center.id}`, "id")} class="mt-2 space-y-1" style="display: none;"> ${formatWorkingHours(center.working_hours).split("\n").map((line) => {
    const [day, time] = line.split(": ");
    return renderTemplate`<div class="flex justify-between py-1"> <span class="font-medium text-gray-700">${day}</span> <span class="text-gray-600">${time}</span> </div>`;
  })} </div> </div> </div>`} </div> <div class="mt-6 flex flex-wrap gap-4"> ${center.phone && renderTemplate`<a${addAttribute(`tel:${center.phone}`, "href")} class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
Call Now
</a>`} ${center.site && renderTemplate`<a${addAttribute(center.site, "href")} target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
Visit Website
</a>`} <button${addAttribute(`window.showDirections(${center.latitude}, ${center.longitude})`, "onclick")} class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
Get Directions
</button> </div> </div> </div>`;
}, "/home/adam/Projects/ewaste-dir/src/components/recycling-centers/CenterCard.astro", void 0);

const $$Astro$1 = createAstro("https://www.recycleoldtech.com");
const $$CentersList = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$CentersList;
  const { centers, defaultLogo } = Astro2.props;
  const sortedCenters = [...centers].sort((a, b) => a.name.localeCompare(b.name));
  return renderTemplate`${maybeRenderHead()}<div class="lg:px-4 lg:py-4"> <div id="centersList" class="space-y-6"> ${sortedCenters.map((center) => renderTemplate`${renderComponent($$result, "CenterCard", $$CenterCard, { "center": center, "defaultLogo": defaultLogo })}`)} </div> </div> <div id="sort-button" class="hidden"> <button id="sortToggle" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"> <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path> </svg> <span>Sort by Rating</span> </button> </div> ${renderScript($$result, "/home/adam/Projects/ewaste-dir/src/components/recycling-centers/CentersList.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/adam/Projects/ewaste-dir/src/components/recycling-centers/CentersList.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a, _b;
const $$Astro = createAstro("https://www.recycleoldtech.com");
const prerender = false;
const $$city = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$city;
  const DEFAULT_LOGO = "/images/recycling.webp";
  Astro2.response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  Astro2.response.headers.set("CDN-Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  const { state: stateParam, city: cityParam } = Astro2.params;
  if (!stateParam || !cityParam) {
    return Astro2.redirect("/404");
  }
  const state = await getState(stateParam);
  if (!state) {
    return Astro2.redirect("/404");
  }
  const cityName = cityParam.split("-").map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(" ");
  const centers = await getRecyclingCentersByCity(stateParam, cityName);
  if (!centers || centers.length === 0) {
    return Astro2.redirect(`/states/${stateParam}`);
  }
  const PRODUCTION_URL = "https://www.recycleoldtech.com";
  const ogImageUrl = new URL("/images/default-og.png", PRODUCTION_URL).toString() ;
  const mapMarkers = centers.map((center) => ({
    lat: Number(center.latitude),
    lng: Number(center.longitude),
    name: center.name,
    address: center.full_address,
    phone: center.phone,
    website: center.site,
    id: center.id
  })).filter((marker) => !isNaN(marker.lat) && !isNaN(marker.lng));
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": `Recycling Centers in ${cityName}, ${state.name}`, "description": `Find ${centers.length} electronics recycling ${centers.length === 1 ? "center" : "centers"} in ${cityName}, ${state.name}. Get directions, contact information, and more.`, "ogImage": ogImageUrl }, { "default": async ($$result2) => renderTemplate(_b || (_b = __template([" ", '<div class="bg-white">  <script>(function(){', `
      window.GOOGLE_MAPS_API_KEY = mapApiKey || '';
      
      // Load Google Maps API using the recommended pattern
      function initGoogleMaps() {
        // console.log('Google Maps API loaded');
        window.dispatchEvent(new Event('google-maps-ready'));
      }
      
      // Define the callback function on the window
      window.initGoogleMaps = initGoogleMaps;
      
      // Load the script if not already loaded
      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const script = document.createElement('script');
        script.src = \`https://maps.googleapis.com/maps/api/js?key=\${window.GOOGLE_MAPS_API_KEY}&callback=initGoogleMaps&libraries=places&v=weekly\`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    })();</script> <!-- Add inline styles to prevent layout shift --> <style>
      @media (min-width: 1024px) {
        .map-container {
          grid-column: 1;
          grid-row: 1;
        }
        .centers-container {
          grid-column: 2;
          grid-row: 1;
        }
      }
    </style> <div class="container mx-auto px-4 py-8"> <!-- Add the global script before any usage --> `, ' <div class="mb-8"> <a', ' class="text-green-600 hover:text-green-700 flex items-center"> <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path> </svg>\nBack to ', ' </a> </div> <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-8"> <div> <h1 class="text-4xl font-display font-bold text-gray-900 mb-2">\nElectronics Recycling in ', ' </h1> <p class="text-xl text-gray-600"> ', " recycling ", " in ", ", ", ' </p> </div> <div id="sort-button-container"></div> </div> <div class="grid grid-cols-1 lg:grid-cols-2 gap-8"> <!-- Map Section --> <div class="map-container rounded-xl overflow-hidden shadow-lg h-[600px] lg:sticky lg:top-8"> ', ' </div> <!-- Recycling Centers List (scrollable) --> <div class="centers-container lg:h-[600px] lg:overflow-y-auto"> ', " </div> </div> </div> </div> ", ""], [" ", '<div class="bg-white">  <script>(function(){', `
      window.GOOGLE_MAPS_API_KEY = mapApiKey || '';
      
      // Load Google Maps API using the recommended pattern
      function initGoogleMaps() {
        // console.log('Google Maps API loaded');
        window.dispatchEvent(new Event('google-maps-ready'));
      }
      
      // Define the callback function on the window
      window.initGoogleMaps = initGoogleMaps;
      
      // Load the script if not already loaded
      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const script = document.createElement('script');
        script.src = \\\`https://maps.googleapis.com/maps/api/js?key=\\\${window.GOOGLE_MAPS_API_KEY}&callback=initGoogleMaps&libraries=places&v=weekly\\\`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    })();</script> <!-- Add inline styles to prevent layout shift --> <style>
      @media (min-width: 1024px) {
        .map-container {
          grid-column: 1;
          grid-row: 1;
        }
        .centers-container {
          grid-column: 2;
          grid-row: 1;
        }
      }
    </style> <div class="container mx-auto px-4 py-8"> <!-- Add the global script before any usage --> `, ' <div class="mb-8"> <a', ' class="text-green-600 hover:text-green-700 flex items-center"> <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path> </svg>\nBack to ', ' </a> </div> <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-8"> <div> <h1 class="text-4xl font-display font-bold text-gray-900 mb-2">\nElectronics Recycling in ', ' </h1> <p class="text-xl text-gray-600"> ', " recycling ", " in ", ", ", ' </p> </div> <div id="sort-button-container"></div> </div> <div class="grid grid-cols-1 lg:grid-cols-2 gap-8"> <!-- Map Section --> <div class="map-container rounded-xl overflow-hidden shadow-lg h-[600px] lg:sticky lg:top-8"> ', ' </div> <!-- Recycling Centers List (scrollable) --> <div class="centers-container lg:h-[600px] lg:overflow-y-auto"> ', " </div> </div> </div> </div> ", ""])), maybeRenderHead(), defineScriptVars({ mapApiKey: "" }), renderScript($$result2, "/home/adam/Projects/ewaste-dir/src/pages/states/[state]/[city].astro?astro&type=script&index=0&lang.ts"), addAttribute(`/states/${stateParam}`, "href"), state.name, cityName, centers.length, centers.length === 1 ? "center" : "centers", cityName, state.name, mapMarkers.length > 0 ? renderTemplate`${renderComponent($$result2, "MapComponent", $$MapComponent, { "markers": mapMarkers, "initialZoom": 12 })}` : renderTemplate`<div class="w-full h-full flex items-center justify-center bg-gray-100"> <p class="text-gray-500">Map not available</p> </div>`, renderComponent($$result2, "CentersList", $$CentersList, { "centers": centers, "defaultLogo": DEFAULT_LOGO }), mapMarkers.length > 0 && renderTemplate`${renderComponent($$result2, "Fragment", Fragment, {}, { "default": async ($$result3) => renderTemplate(_a || (_a = __template([" <script>\n        // Define global direction functions\n        window.showDirections = function(lat, lng) {\n          if (!lat || !lng) return;\n          window.open('https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng, '_blank');\n        };\n        window.openDirections = window.showDirections;\n      </script> ", " "])), renderScript($$result3, "/home/adam/Projects/ewaste-dir/src/pages/states/[state]/[city].astro?astro&type=script&index=1&lang.ts")) })}`) })}`;
}, "/home/adam/Projects/ewaste-dir/src/pages/states/[state]/[city].astro", void 0);
const $$file = "/home/adam/Projects/ewaste-dir/src/pages/states/[state]/[city].astro";
const $$url = "/states/[state]/[city]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$city,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
