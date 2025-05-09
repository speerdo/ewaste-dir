// netlify/functions/ssr.js
// This file is the entry point for all SSR functions.
// It imports and runs the Astro SSR handler.

// Use a try-catch block to handle potential file name changes due to Netlify function name requirements
export async function handler(event, context) {
  try {
    // First try the standard import path
    const { handler: ssrHandler } = await import('./entry.mjs');
    return await ssrHandler(event, context);
  } catch (err) {
    console.log(
      'Error importing standard entry file, trying renamed version:',
      err
    );
    try {
      // Try the renamed import path (with @ replaced by _)
      const { handler: ssrHandler } = await import(
        './_astrojs-ssr-adapter.mjs'
      );
      return await ssrHandler(event, context);
    } catch (fallbackErr) {
      console.error('Failed to import any handler:', fallbackErr);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Server configuration error',
          message: 'Failed to load SSR handler',
        }),
      };
    }
  }
}
