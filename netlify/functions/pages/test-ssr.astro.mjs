/* empty css                                 */
import { c as createAstro, a as createComponent, b as renderComponent, r as renderTemplate, m as maybeRenderHead, f as renderScript } from '../chunks/astro/server_BBuoheSG.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_CWDkWl7g.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro("https://www.recycleoldtech.com");
const prerender = false;
const $$TestSsr = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$TestSsr;
  const requestUrl = Astro2.request.url;
  const headers = Object.fromEntries(Astro2.request.headers.entries());
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  Astro2.response.headers.set("X-SSR-Test", "true");
  Astro2.response.headers.set("X-Request-Time", timestamp);
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "SSR Test Page" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="container mx-auto px-4 py-12"> <h1 class="text-3xl font-bold text-green-600 mb-6">SSR Test Page</h1> <div class="bg-white shadow-lg rounded-lg p-6 mb-8"> <h2 class="text-xl font-semibold mb-4">Request Information</h2> <div class="grid grid-cols-1 gap-4"> <div class="border-b pb-2"> <span class="font-medium">URL:</span> ${requestUrl} </div> <div class="border-b pb-2"> <span class="font-medium">Time:</span> ${timestamp} </div> <div class="border-b pb-2"> <span class="font-medium">SSR Enabled:</span> Yes (this page is rendered on the server)
</div> </div> </div> <div class="bg-white shadow-lg rounded-lg p-6 mb-8"> <h2 class="text-xl font-semibold mb-4">Request Headers</h2> <pre class="bg-gray-100 p-4 rounded overflow-auto max-h-60 text-sm">        ${JSON.stringify(headers, null, 2)}
      </pre> </div> <div class="bg-white shadow-lg rounded-lg p-6"> <h2 class="text-xl font-semibold mb-4">Environment</h2> <pre class="bg-gray-100 p-4 rounded overflow-auto max-h-60 text-sm">        NODE_ENV: ${"production"}
        PROD: ${"true" }
        DEV: ${"false"}
        BASE_URL: ${"/"}
        SITE: ${"https://www.recycleoldtech.com"}
      </pre> </div> <div class="mt-8"> <a href="/" class="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
Back to Home
</a> <a href="/states/new-york" class="ml-4 inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition">
Test States Page
</a> </div> </div> ${renderScript($$result2, "/home/adam/Projects/ewaste-dir/src/pages/test-ssr.astro?astro&type=script&index=0&lang.ts")} ` })}`;
}, "/home/adam/Projects/ewaste-dir/src/pages/test-ssr.astro", void 0);
const $$file = "/home/adam/Projects/ewaste-dir/src/pages/test-ssr.astro";
const $$url = "/test-ssr";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$TestSsr,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
