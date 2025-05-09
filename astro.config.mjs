import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

// Production domain
const PRODUCTION_URL = 'https://www.recycleoldtech.com';

// Get the site URL from environment variables or use a default for preview deployments
const NETLIFY_URL = process.env.NETLIFY_URL || process.env.URL;
const SITE_URL =
  process.env.SITE_URL || (NETLIFY_URL ? NETLIFY_URL : PRODUCTION_URL);

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  integrations: [tailwind()],
  output: 'server',
  adapter: netlify({
    imageCDN: true,
    dist: new URL('./dist/', import.meta.url),
    functionPerRoute: false,
    edgeMiddleware: true,
  }),
  build: {
    inlineStylesheets: 'auto',
    assets: 'assets',
    format: 'directory',
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY': JSON.stringify(
        process.env.PUBLIC_GOOGLE_MAPS_API_KEY
      ),
    },
    build: {
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'google-maps': ['@googlemaps/js-api-loader'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    ssr: {
      noExternal: ['@supabase/supabase-js'],
      optimizeDeps: {
        include: ['@supabase/supabase-js'],
      },
    },
  },
  compressHTML: true,
});
