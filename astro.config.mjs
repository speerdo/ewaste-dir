import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
  adapter:
    process.env.NODE_ENV === 'production'
      ? vercel({
          analytics: true,
          imageService: true,
          speedInsights: true,
        })
      : node({
          mode: 'standalone',
        }),
  build: {
    // Static site generation performance optimizations
    format: 'file',
    assets: 'assets',
    // Set build concurrency for large builds
    concurrentPages: 2, // Limiting concurrent page generation to manage memory
    // Enable build reporting to monitor progress
    reporter: {
      config: {
        reportDetailLevel: 'verbose',
      },
    },
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY': JSON.stringify(
        process.env.PUBLIC_GOOGLE_MAPS_API_KEY
      ),
    },
    build: {
      // Reduce build log verbosity
      reportCompressedSize: false,
      // Optimize large chunks
      chunkSizeWarningLimit: 1000,
    },
    // Optimize memory usage
    optimizeDeps: {
      force: true,
    },
    // Ensure shared dependencies are split properly
    ssr: {
      noExternal: ['@supabase/supabase-js'],
    },
  },
  routes: [
    {
      pattern: '/api/*',
      entryPoint: 'src/api/*.ts',
    },
  ],
  // Enable HTML compression for smaller file sizes
  compressHTML: true,
});
