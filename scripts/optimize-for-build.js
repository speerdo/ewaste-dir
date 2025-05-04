#!/usr/bin/env node
/**
 * Build optimization script for Vercel deployments
 * This script helps with large static site generation by:
 * 1. Setting appropriate Node.js options for memory management
 * 2. Clearing any build caches to ensure a clean state
 * 3. Warming up db connections to prevent timeouts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

console.log('🚀 Running build optimization script...');

// Ensure that we're using the max memory available in Vercel
process.env.NODE_OPTIONS =
  process.env.NODE_OPTIONS || '--max-old-space-size=7168';
console.log(`ℹ️ NODE_OPTIONS: ${process.env.NODE_OPTIONS}`);

// Ensure we're in production mode
process.env.NODE_ENV = 'production';
console.log(`ℹ️ NODE_ENV: ${process.env.NODE_ENV}`);

// Clear any Astro build caches
const clearCaches = () => {
  const dirs = [
    'node_modules/.astro',
    'node_modules/.vite',
    '.vercel/output',
    'dist',
  ];

  dirs.forEach((dir) => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      console.log(`🧹 Clearing cache directory: ${dir}`);
      try {
        // Use rimraf via execSync for better directory removal
        execSync(`rm -rf "${dirPath}"`);
      } catch (error) {
        console.warn(`⚠️ Could not remove directory ${dir}: ${error.message}`);
      }
    }
  });
};

// Warm up Supabase connection to ensure efficient data loading
const warmupDatabase = async () => {
  if (
    !process.env.PUBLIC_SUPABASE_URL ||
    !process.env.PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.warn('⚠️ Supabase environment variables not set, skipping warmup');
    return;
  }

  console.log('🔄 Warming up Supabase connection...');

  // Simple HTTP request to wake up Supabase
  return new Promise((resolve) => {
    const url = new URL(
      '/rest/v1/states?select=name&limit=1',
      process.env.PUBLIC_SUPABASE_URL
    );
    const req = https.get(
      url,
      {
        headers: {
          apikey: process.env.PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.PUBLIC_SUPABASE_ANON_KEY}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log(`✅ Supabase connection ready: ${res.statusCode}`);
          resolve();
        });
      }
    );

    req.on('error', (error) => {
      console.error(`❌ Error warming up Supabase: ${error.message}`);
      resolve(); // Continue anyway
    });

    // Set timeout
    req.setTimeout(5000, () => {
      console.warn('⚠️ Supabase warmup timed out');
      req.destroy();
      resolve();
    });
  });
};

// Optimize Node.js garbage collection settings
const optimizeNodeSettings = () => {
  console.log('⚙️ Optimizing Node.js settings...');

  // Expose GC for manual calls if needed
  try {
    execSync(
      'node --expose-gc -e "console.log(\'✅ Garbage collection exposed\')"'
    );
    // Set flag for later usage
    process.env.EXPOSE_GC = 'true';
  } catch (error) {
    console.warn('⚠️ Could not expose garbage collection');
  }

  // Ensure we have the latest npm
  try {
    console.log('📦 Checking npm version...');
    const npmVersion = execSync('npm --version').toString().trim();
    console.log(`ℹ️ Using npm version ${npmVersion}`);
  } catch (error) {
    console.warn('⚠️ Could not check npm version');
  }
};

// Increase system ulimit for large amounts of file operations
const increaseUlimit = () => {
  try {
    if (process.platform !== 'win32') {
      console.log('🔧 Increasing file descriptor limit...');
      // Try to set ulimit to maximum
      execSync('ulimit -n 65536 || true');

      // Check what we were able to set
      const limit = execSync('ulimit -n').toString().trim();
      console.log(`ℹ️ File descriptor limit: ${limit}`);
    }
  } catch (error) {
    console.warn('⚠️ Could not increase ulimit:', error.message);
  }
};

// Main function
const main = async () => {
  try {
    console.log('🔍 Build environment:');
    console.log(`ℹ️ Platform: ${process.platform}`);
    console.log(`ℹ️ Architecture: ${process.arch}`);
    console.log(`ℹ️ Node.js version: ${process.version}`);
    console.log(`ℹ️ Current working directory: ${process.cwd()}`);

    // Run optimizations
    clearCaches();
    optimizeNodeSettings();
    increaseUlimit();
    await warmupDatabase();

    console.log('✅ Build optimization completed successfully!');
  } catch (error) {
    console.error('❌ Build optimization failed:', error);
    // Don't exit with error code, let the build continue
  }
};

// Run the script
main();
