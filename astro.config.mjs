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
  outDir: './dist',
  adapter: vercel({
    analytics: true,
    // Don't use static workers in this build to avoid issues
    staticWorkers: false,
    // Don't use minification during build to avoid issues
    minify: false,
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
      // Use esbuild for compatibility
      minify: 'esbuild',
      // Disable sourcemaps to save space
      sourcemap: false,
      // Split build across chunks to avoid out-of-memory issues
      rollupOptions: {
        output: {
          // Simpler chunk strategy
          manualChunks: {
            vendor: ['@supabase/supabase-js', '@googlemaps/js-api-loader'],
          },
        },
      },
    },
    // Override dependencies to improve compatibility
    ssr: {
      noExternal: ['@supabase/supabase-js'],
    },
    // Avoid using native binaries where possible
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2020',
      },
    },
  },
  // Don't use image processing in parallel
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        concurrency: 2,
      },
    },
  },
});
