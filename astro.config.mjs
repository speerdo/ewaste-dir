import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';
import sitemap from '@astrojs/sitemap';

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
      filter: (page) => !page.includes('404'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date().toISOString(),
    }),
  ],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    imageService: true,
    devImageService: 'sharp',
    speedInsights: true,
    edgeMiddleware: true,
    maxDuration: 8,
    functionPerRoute: false,
    excludeFiles: ['src/assets/**/*', 'public/**/*'],
  }),
  build: {
    inlineStylesheets: 'auto',
    assets: 'assets',
    serverEntry: 'entry.mjs',
    format: 'directory',
  },
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        // Image optimization settings
        quality: 80, // Reduce image quality to 80% for better compression
        format: ['avif', 'webp', 'jpeg', 'png'], // Prioritize modern formats
        cacheDir: './.astro/cache',
        logLevel: 'info',
      },
    },
    domains: ['images.unsplash.com'], // Allow optimization for external domains
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
      cssCodeSplit: true, // Split CSS for better caching
      minify: 'esbuild', // Use esbuild instead of terser (built into Vite)
      rollupOptions: {
        output: {
          manualChunks: {
            'google-maps': ['@googlemaps/js-api-loader'],
            supabase: ['@supabase/supabase-js'],
            // Add more chunks as needed for common dependencies
            'common-ui': [
              './src/components/Header.astro',
              './src/components/Footer.astro',
            ],
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
    esbuild: {
      // Add esbuild options for minification
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      keepNames: false, // Set to true if you need to preserve function names
      drop: ['console', 'debugger'], // Drop console and debugger statements
    },
  },
  routes: [
    {
      pattern: '/api/*',
      entryPoint: 'src/api/*.ts',
    },
  ],
  compressHTML: true,
});
