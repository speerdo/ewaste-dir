// netlify/functions/ssr.js
// This file is the entry point for all SSR functions.
// It imports and runs the Astro SSR handler.

import { handler as ssrHandler } from './entry.mjs';

// Export a function for handling Netlify Function requests
export async function handler(event, context) {
  // Process SSR request with Astro
  const response = await ssrHandler(event, context);
  return response;
}
