import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/static';
import tailwind from '@astrojs/tailwind';

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
  integrations: [tailwind()],
  vite: {
    build: {
      // Increase chunk size to reduce file count
      chunkSizeWarningLimit: 1000,
      // Use esbuild for compatibility
      minify: 'esbuild',
      // Disable sourcemaps to save space
      sourcemap: false,
    },
    // Avoid using native binaries where possible
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2020',
      },
    },
  },
});
