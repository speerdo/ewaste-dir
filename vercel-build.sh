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

# If npm is used
if [ -f "package-lock.json" ]; then
  # Optimize npm for disk space
  npm config set cache-min 9999999
  # Install dependencies with production only flag to reduce size
  npm ci --production=false --no-optional
  # Skip audit which uses disk space
  npm config set audit false
else
  # If yarn is used
  yarn install --frozen-lockfile --non-interactive
fi

# Clean tmp directories
rm -rf /tmp/*

# Run the optimized build
echo "Running optimized build..."
npm run build

# Print disk usage after build
echo "Disk usage after build:"
df -h

# Count number of generated files
if [ -d ".vercel/output/static" ]; then
  echo "Generated file count:"
  find .vercel/output/static -type f | wc -l
fi

# Success!
echo "Build completed successfully" 
