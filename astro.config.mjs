import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';
import node from '@astrojs/node';

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
  integrations: [tailwind()],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    imageService: true,
    devImageService: 'sharp',
    speedInsights: true,
    isr: {
      expiration: 3600,
      allowQuery: true,
      byRoute: {
        '/': { expiration: 86400 },
        '/about': { expiration: 86400 },
        '/contact': { expiration: 86400 },
        '/blog': { expiration: 86400 },
        '/states/*': { expiration: 3600 },
        '/cities/*': { expiration: 3600 },
        '/api/*': false, // Disable ISR for API routes
      },
    },
    edgeMiddleware: true,
    maxDuration: 8,
    functionPerRoute: true,
    edges: [
      {
        name: 'api',
        pattern: {
          static: [
            '/api/zipfind',
            '/api/geocode',
            '/api/cities-data',
            '/api/zipcode',
          ],
        },
        config: {
          runtime: 'edge',
          regions: 'all',
        },
      },
    ],
    analytics: true,
  }),
  build: {
    inlineStylesheets: 'auto',
    assets: 'assets',
    serverEntry: 'entry.mjs',
    format: 'directory',
    outDir: 'dist',
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
