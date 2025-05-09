/* empty css                                 */
import { c as createAstro, a as createComponent, b as renderComponent, r as renderTemplate, m as maybeRenderHead, f as renderScript } from '../chunks/astro/server_BBuoheSG.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_CWDkWl7g.mjs';
export { renderers } from '../renderers.mjs';

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "PUBLIC_GOOGLE_MAPS_API_KEY": "", "PUBLIC_SITE_URL": "https://your-netlify-app.netlify.app", "PUBLIC_SUPABASE_ANON_KEY": "dummy-key-for-build-process", "PUBLIC_SUPABASE_URL": "https://example.supabase.co", "SITE": "https://www.recycleoldtech.com", "SSR": true};
const $$Astro = createAstro("https://www.recycleoldtech.com");
const prerender = false;
const meta = {
  "X-Debug-Page": "true",
  "X-Rendered-At": timestamp
};
const $$EnvDebug = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$EnvDebug;
  const url = Astro2.url;
  const pathname = url.pathname;
  const headers = Object.fromEntries(Astro2.request.headers.entries());
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  const envVars = {};
  for (const key in Object.assign(__vite_import_meta_env__, { _: process.env._ })) {
    if (!key.includes("KEY") && !key.includes("SECRET") && !key.includes("TOKEN")) {
      envVars[key] = String(Object.assign(__vite_import_meta_env__, { _: process.env._ })[key]);
    } else {
      envVars[key] = "[REDACTED]";
    }
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Environment Debug" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="container mx-auto px-4 py-8"> <h1 class="text-3xl font-bold text-blue-600 mb-6">Environment Diagnostics</h1> <div class="bg-white shadow rounded-lg p-6 mb-8"> <h2 class="text-xl font-semibold mb-4">Request Information</h2> <div class="grid grid-cols-1 gap-4"> <div class="border-b pb-2"> <span class="font-medium">URL:</span> ${url.toString()} </div> <div class="border-b pb-2"> <span class="font-medium">Pathname:</span> ${pathname} </div> <div class="border-b pb-2"> <span class="font-medium">Time:</span> ${timestamp2} </div> </div> </div> <div class="bg-white shadow rounded-lg p-6 mb-8"> <h2 class="text-xl font-semibold mb-4">Request Headers</h2> <pre class="bg-gray-100 p-4 rounded overflow-auto max-h-60 text-sm">        ${JSON.stringify(headers, null, 2)}
      </pre> </div> <div class="bg-white shadow rounded-lg p-6"> <h2 class="text-xl font-semibold mb-4">Environment Variables</h2> <pre class="bg-gray-100 p-4 rounded overflow-auto max-h-60 text-sm">        ${JSON.stringify(envVars, null, 2)}
      </pre> </div> <div class="mt-8 space-x-4"> <a href="/" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition">
Home
</a> <a href="/test-ssr" class="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
Test SSR
</a> <a href="/debug-request" class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition">
Function Debug
</a> <a href="/states/new-york" class="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">
Test States
</a> </div> </div> ${renderScript($$result2, "/home/adam/Projects/ewaste-dir/src/pages/env-debug.astro?astro&type=script&index=0&lang.ts")} ` })}`;
}, "/home/adam/Projects/ewaste-dir/src/pages/env-debug.astro", void 0);
const $$file = "/home/adam/Projects/ewaste-dir/src/pages/env-debug.astro";
const $$url = "/env-debug";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$EnvDebug,
  file: $$file,
  meta,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
