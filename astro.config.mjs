import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'hybrid',
  adapter: vercel({
    analytics: true,
    imageService: true,
    speedInsights: true,
    webAnalytics: true,
    isr: {
      expiration: 3600,
      allowQuery: false,
    },
    edgeMiddleware: true,
    maxDuration: 8,
  }),
  build: {
    inlineStylesheets: 'auto',
    assets: 'assets',
    concurrentPages: 4,
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
  routes: [
    {
      pattern: '/api/*',
      entryPoint: 'src/api/*.ts',
    },
  ],
  compressHTML: true,
});
