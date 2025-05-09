/* empty css                                 */
import { a as createComponent, b as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_BBuoheSG.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_CWDkWl7g.mjs';
import '@astrojs/internal-helpers/path';
import '@astrojs/internal-helpers/remote';
import { $ as $$Image } from '../chunks/_astro_assets_B_1Othnc.mjs';
export { renderers } from '../renderers.mjs';

const $$404 = createComponent(($$result, $$props, $$slots) => {
  const title = "404 - Page Not Found";
  const description = "Oops! This page seems to have been improperly recycled.";
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": title, "description": description }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="container mx-auto px-4 py-16 text-center"> <h1 class="text-6xl font-bold mb-4 text-primary-600">4<span class="text-error-600">0</span>4</h1> <div class="max-w-3xl mx-auto"> <div class="mb-8"> ${renderComponent($$result2, "Image", $$Image, { "src": "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80", "alt": "Pile of electronic waste", "width": 500, "height": 300, "class": "mx-auto rounded-lg shadow-lg" })} </div> <h2 class="text-2xl font-bold mb-4">Oops! This Page Has Been Improperly Recycled</h2> <p class="text-lg mb-6">
Just like that obsolete flip phone from 2005, this page is no longer in service.
</p> <div class="bg-secondary-100 p-6 rounded-lg mb-8 text-left"> <h3 class="font-bold text-xl mb-2">Error Diagnosis:</h3> <ul class="list-disc pl-6 space-y-2"> <li>The URL might be experiencing a <span class="font-mono bg-slate-200 px-1">battery depletion error</span></li> <li>This page may have been recycled into a newer, more energy-efficient model</li> <li>The server might be experiencing <span class="font-mono bg-slate-200 px-1">outdated hardware syndrome</span></li> <li>Possibly crushed in an e-waste compactor</li> </ul> </div> <p class="text-lg mb-10">
Unlike electronic waste, you don't need to find a special facility to get back on track. 
        You can simply return to our homepage!
</p> <a href="/" class="inline-block bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
Return to Homepage
</a> </div> <div class="mt-16 max-w-xl mx-auto py-6 px-8 bg-slate-100 rounded-lg"> <h3 class="font-bold text-lg mb-2">Did You Know?</h3> <p>
The average American household has about 24 electronic devices, and worldwide, 
        we generate approximately 50 million tons of e-waste every year. 
        Don't let your old electronics end up like this page—recycle them properly!
</p> </div> </div> ` })}`;
}, "/home/adam/Projects/ewaste-dir/src/pages/404.astro", void 0);

const $$file = "/home/adam/Projects/ewaste-dir/src/pages/404.astro";
const $$url = "/404";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$404,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
