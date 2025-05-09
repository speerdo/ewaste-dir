import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Create .env file for Netlify if missing or merge with existing
const dotenvPath = path.join(rootDir, '.env');
const netlifyEnvVariables = {
  // Add any required environment variables for Netlify here
  PUBLIC_SITE_URL: process.env.URL || 'https://your-netlify-app.netlify.app',
  PUBLIC_GOOGLE_MAPS_API_KEY: process.env.PUBLIC_GOOGLE_MAPS_API_KEY || '',
  PUBLIC_SUPABASE_URL:
    process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  PUBLIC_SUPABASE_ANON_KEY:
    process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '',
};

// Ensure we have dummy Supabase values for development/build if not provided
if (!netlifyEnvVariables.PUBLIC_SUPABASE_URL) {
  console.log(
    'WARNING: No Supabase URL provided. Using dummy value for build.'
  );
  netlifyEnvVariables.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
}

if (!netlifyEnvVariables.PUBLIC_SUPABASE_ANON_KEY) {
  console.log(
    'WARNING: No Supabase anon key provided. Using dummy value for build.'
  );
  netlifyEnvVariables.PUBLIC_SUPABASE_ANON_KEY = 'dummy-key-for-build-process';
}

// Create .env content
const dotenvContent = Object.entries(netlifyEnvVariables)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

// Write to .env file
console.log('Writing environment variables for Netlify deployment...');
writeFileSync(dotenvPath, dotenvContent);

// Create redirects file for Netlify
const redirectsPath = path.join(rootDir, 'public', '_redirects');
const redirectsDir = path.dirname(redirectsPath);

if (!existsSync(redirectsDir)) {
  mkdirSync(redirectsDir, { recursive: true });
}

const redirectsContent = `
# Netlify redirects
/api/*  /.netlify/functions/:splat  200
/*      /index.html                 200
`;

console.log('Writing Netlify redirects file...');
writeFileSync(redirectsPath, redirectsContent.trim());

console.log('Netlify setup complete!');
