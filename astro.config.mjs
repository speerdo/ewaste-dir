import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/edge';

// https://astro.build/config
export default defineConfig({
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
      allowQuery: false,
      byRoute: {
        '/': { expiration: 86400 },
        '/about': { expiration: 86400 },
        '/contact': { expiration: 86400 },
        '/blog': { expiration: 86400 },
        '/states/*': { expiration: 3600 },
        '/cities/*': { expiration: 3600 },
        '/api/*': { expiration: 300 },
      },
    },
    edgeMiddleware: true,
    maxDuration: 8,
    functionPerRoute: true,
  }),
  build: {
    inlineStylesheets: 'auto',
    assets: 'assets',
    serverEntry: 'entry.mjs',
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
  routes: [
    {
      pattern: '/api/*',
      entryPoint: 'src/api/*.ts',
    },
  ],
  compressHTML: true,
});
