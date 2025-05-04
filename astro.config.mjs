import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel/static';

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
          buildOutput: {
            minify: true,
          },
        })
      : node({
          mode: 'standalone',
        }),
  // Increase build performance
  build: {
    // Use more worker threads for parallel processing
    // This helps with large static site generation
    inlineStylesheets: 'never',
    format: 'file',
    assets: 'assets',
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
      // Increase build speed
      minify: 'terser',
      // Split chunks more aggressively for parallel loading
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
      // Increase Vite's performance
      cssCodeSplit: false,
      assetsInlineLimit: 0,
      // Add source map for production debugging if needed
      sourcemap: false,
      // Increase bundle write speed
      write: true,
      // Enable multi-threading
      emptyOutDir: true,
      copyPublicDir: true,
      chunkSizeWarningLimit: 1000,
    },
    // Optimize server performance during build
    server: {
      fs: {
        strict: false,
      },
      hmr: {
        overlay: false,
      },
    },
    // Optimize for large builds
    optimizeDeps: {
      // Force inclusion of these dependencies
      include: ['tailwindcss'],
    },
  },
  routes: [
    {
      pattern: '/api/*',
      entryPoint: 'src/api/*.ts',
    },
  ],
});
