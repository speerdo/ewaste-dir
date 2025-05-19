#!/bin/bash

# Print disk usage before build
echo "Disk usage before build:"
df -h

# Clean node_modules cache if space is low
FREE_DISK_KB=$(df -k . | tail -1 | awk '{print $4}')
if [ $FREE_DISK_KB -lt 10485760 ]; then # Less than 10GB free
  echo "Low disk space detected, cleaning caches..."
  rm -rf node_modules/.cache
  rm -rf .vercel/cache
fi

# Clean up existing node_modules to prevent dependency issues
if [ -d "node_modules" ]; then
  echo "Removing existing node_modules to ensure clean install..."
  rm -rf node_modules
fi

# If npm is used
if [ -f "package-lock.json" ]; then
  # Install dependencies with clean slate
  echo "Installing dependencies..."
  npm ci
  
  # Fix for Rollup binary dependency issues
  echo "Installing platform-specific dependencies..."
  npm install --no-save @rollup/rollup-linux-x64-gnu
else
  # If yarn is used
  yarn install --frozen-lockfile --non-interactive
  yarn add --dev @rollup/rollup-linux-x64-gnu
fi

# Clean tmp directories
rm -rf /tmp/*

# Create required directories for output
mkdir -p .vercel/output/static
mkdir -p dist

# Run the build without using npm scripts (avoids subshell issues)
echo "Running Astro build..."
NODE_OPTIONS="--max-old-space-size=4096" NODE_ENV=production npx astro build

# Run post-build script to ensure files are in the right place
echo "Running post-build script..."
node scripts/post-build.js

# Print disk usage after build
echo "Disk usage after build:"
df -h

# Count number of generated files
if [ -d ".vercel/output/static" ]; then
  echo "Generated file count:"
  find .vercel/output/static -type f | wc -l
else
  echo "Error: No output directory found!"
  exit 1
fi

# Success!
echo "Build completed successfully" 
