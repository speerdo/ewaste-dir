# Netlify Deployment Instructions

This document outlines the steps for deploying this application to Netlify with proper SSR support.

## Function Naming Fix

This project includes a fix for a common issue with the Astro Netlify adapter where function files with `@` characters in their names cause deployment failures. The error looks like this:

```
Error: Serverless function `_@astrojs-ssr-adapter` has an invalid name. The name should only contain alphanumeric characters, hyphens, or underscores.
```

Our solution:

1. We've added a `functionName` callback in `astro.config.mjs` to sanitize function names.
2. We've created a post-build script that:
   - Finds and renames problematic files with `@` characters
   - Updates all references to these renamed files
   - Works recursively through all build directories

## Deployment Configuration

### Build Settings

In your Netlify site dashboard, configure the following build settings:

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18.x or higher

### Environment Variables

Make sure to set the following environment variables in your Netlify site dashboard:

- `PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `PUBLIC_GOOGLE_MAPS_API_KEY` (if needed): Your Google Maps API key

## Pre-Deployment Preparation

Before deploying to Netlify, make sure to:

1. Run the city data generation script locally to create the city data file:

   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co PUBLIC_SUPABASE_ANON_KEY=your-anon-key node scripts/generateCityData.js > src/data/generatedCityData.json
   ```

2. Commit this data file to your repository so it's available during the build process.

## Testing Locally

To test the Netlify deployment locally:

1. Install the Netlify CLI: `npm install -g netlify-cli`
2. Run `netlify dev` to test the site locally with Netlify functions

## Deployment Steps

1. Push your changes to GitHub
2. Connect your repository to Netlify
3. Configure the build settings as mentioned above
4. Deploy your site

## Troubleshooting

If you encounter issues with SSR routes not working:

1. Check the Netlify function logs in the Netlify dashboard
2. Ensure the `netlify.toml` file has the correct redirect rules
3. Make sure all environment variables are properly set
4. Verify that the Netlify adapter is correctly configured in `astro.config.mjs`

### Common Issues

1. **Invalid function names**: Our build process includes automatic fixing of invalid function names (containing `@` symbols). If you see this error, ensure our post-build script ran correctly.

2. **Missing dependencies**: Verify that all required dependencies are properly installed.

3. **Redirect issues**: Check the Netlify logs to ensure that requests are being properly routed to the SSR function.

## Key Files

The following files are critical for proper Netlify deployment:

- `netlify.toml`: Contains redirect rules and build configuration
- `netlify/functions/ssr.js`: The entry point for SSR functions
- `netlify/functions/cities-data.js`: Fallback function for city data API
- `astro.config.mjs`: Contains the Netlify adapter configuration with function name sanitization
- `scripts/setup-netlify.js`: Sets up necessary files for Netlify deployment
- `scripts/postbuild-netlify.js`: Fixes invalid function names
- `src/data/generatedCityData.json`: Pre-generated city data for fallback

## Notes

- Netlify has a function timeout of 10 seconds, so ensure API calls complete within this limit
- The SSR function bundle size should be kept under 50MB
- For large datasets, consider pre-generating files during build rather than fetching at runtime
