import { renderers } from './renderers.mjs';
import { s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_CvSoi7hX.mjs';
import { manifest } from './manifest_BfFlQxzV.mjs';
import { createExports } from '@astrojs/netlify/ssr-function.js';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/404.astro.mjs');
const _page2 = () => import('./pages/about.astro.mjs');
const _page3 = () => import('./pages/api/cities-data.astro.mjs');
const _page4 = () => import('./pages/api/geocode.astro.mjs');
const _page5 = () => import('./pages/api/search/suggestions.astro.mjs');
const _page6 = () => import('./pages/api/zipcode.astro.mjs');
const _page7 = () => import('./pages/blog.astro.mjs');
const _page8 = () => import('./pages/blog/_---slug_.astro.mjs');
const _page9 = () => import('./pages/contact.astro.mjs');
const _page10 = () => import('./pages/env-debug.astro.mjs');
const _page11 = () => import('./pages/search.astro.mjs');
const _page12 = () => import('./pages/states/_state_/_city_.astro.mjs');
const _page13 = () => import('./pages/states/_state_.astro.mjs');
const _page14 = () => import('./pages/test-ssr.astro.mjs');
const _page15 = () => import('./pages/thanks.astro.mjs');
const _page16 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/404.astro", _page1],
    ["src/pages/about.astro", _page2],
    ["src/pages/api/cities-data.ts", _page3],
    ["src/pages/api/geocode.ts", _page4],
    ["src/pages/api/search/suggestions.ts", _page5],
    ["src/pages/api/zipcode.ts", _page6],
    ["src/pages/blog/index.astro", _page7],
    ["src/pages/blog/[...slug].astro", _page8],
    ["src/pages/contact.astro", _page9],
    ["src/pages/env-debug.astro", _page10],
    ["src/pages/search.astro", _page11],
    ["src/pages/states/[state]/[city].astro", _page12],
    ["src/pages/states/[state].astro", _page13],
    ["src/pages/test-ssr.astro", _page14],
    ["src/pages/thanks.astro", _page15],
    ["src/pages/index.astro", _page16]
]);
const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
    middleware: undefined
});
const _args = {
    "middlewareSecret": "991080f4-8aaa-4fab-8d71-25d6c73d98a5"
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (_start in serverEntrypointModule) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
