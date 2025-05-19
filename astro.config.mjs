import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/static';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';

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
  output: 'static',
  adapter: vercel({
    analytics: true,
    // Split build into smaller chunks to reduce memory usage
    staticWorkers: 4,
    // Keep intermediate files to a minimum
    minify: true,
  }),
  integrations: [
    vue(),
    tailwind(),
    sitemap({
      // Limit concurrent requests to reduce memory pressure
      entryLimit: 5000,
      // Skip draft and staging pages
      filter: (page) =>
        !page.includes('/drafts/') && !page.includes('/staging/'),
    }),
    partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
  ],
  vite: {
    build: {
      // Increase chunk size to reduce file count
      chunkSizeWarningLimit: 1000,
      // Minimize and optimize output
      minify: 'terser',
      // Split build across chunks to avoid out-of-memory issues
      rollupOptions: {
        output: {
          manualChunks: {
            'react-map': ['react', 'react-dom', 'leaflet'],
            utils: ['dayjs', 'lodash-es'],
          },
        },
      },
    },
    // Reduce build asset size and memory usage
    ssr: {
      noExternal: ['react-leaflet'],
    },
  },
  // Limit processing of images in parallel to reduce memory use
  image: {
    service: {
      concurrency: 5,
    },
  },
});
