import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';

// Production domain
const PRODUCTION_URL = 'https://www.recycleoldtech.com';

// Get the site URL from environment variables or use a default for preview deployments
const VERCEL_URL = process.env.VERCEL_URL;
const SITE_URL =
  process.env.SITE_URL ||
  (VERCEL_URL ? `https://${VERCEL_URL}` : PRODUCTION_URL);

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  integrations: [
    tailwind(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      // Optionally customize URL generation
      serialize(item) {
        // Customize priority based on URL patterns
        if (item.url === SITE_URL + '/') {
          item.priority = 1.0;
        } else if (item.url.includes('/blog/')) {
          item.priority = 0.7;
        } else if (item.url.match(/\/states\/[^\/]+\/[^\/]+$/)) {
          item.priority = 0.9; // City pages
        } else if (item.url.includes('/states/')) {
          item.priority = 0.8; // State pages
        }
        return item;
      },
    }),
  ],
  output: 'hybrid',
  adapter: vercel(),
  build: {
    inlineStylesheets: 'auto',
    assets: 'assets',
    format: 'directory',
  },
  image: {
    // Enable image optimization
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
    remotePatterns: [{ protocol: 'https' }],
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
  },
  compressHTML: true,
});
