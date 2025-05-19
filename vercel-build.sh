#!/bin/bash

# --- Configuration ---
# Approximate number of city pages to determine chunks.
# This should be slightly higher than the actual number to be safe.
TOTAL_CITY_PAGES=${TOTAL_CITY_PAGES:-10000} # Default to 10,000, can be overridden by Vercel env var
PAGES_PER_BUILD=${PAGES_PER_BUILD:-2000}  # Default to 2000, can be overridden
NUM_CHUNKS=$(( (TOTAL_CITY_PAGES + PAGES_PER_BUILD - 1) / PAGES_PER_BUILD ))

ACCUMULATED_DIST_DIR=".temp-accumulated-dist"
FINAL_VERCEL_OUTPUT_DIR=".vercel/output/static"

echo "--- Build Configuration ---"
echo "Total City Pages (Estimated): $TOTAL_CITY_PAGES"
echo "Pages Per Build Chunk: $PAGES_PER_BUILD"
echo "Number of Chunks: $NUM_CHUNKS"
echo "Accumulated Dist Dir: $ACCUMULATED_DIST_DIR"
echo "Final Vercel Output Dir: $FINAL_VERCEL_OUTPUT_DIR"
echo "---------------------------"

# --- Initial Cleanup and Setup ---
echo "Disk usage before build process:"
df -h

# Clean caches if space is low
FREE_DISK_KB=$(df -k . | tail -1 | awk '{print $4}')
if [ $FREE_DISK_KB -lt 15728640 ]; then # Less than 15GB free
  echo "Low disk space detected, cleaning caches thoroughly..."
  rm -rf node_modules/.cache node_modules/.vite .astro .vercel/cache /tmp/*
fi

# Clean up existing node_modules, accumulated dist, and previous Vercel output
echo "Performing initial cleanup..."
rm -rf node_modules "$ACCUMULATED_DIST_DIR" .vercel/output dist .temp-build scripts/restore-files.sh
mkdir -p "$ACCUMULATED_DIST_DIR" "$FINAL_VERCEL_OUTPUT_DIR" dist # Ensure dist exists for Astro

# --- Install rsync ---
echo "Installing rsync..."
if yum update -y && yum install -y rsync; then
  echo "rsync installed successfully."
else
  echo "Warning: Failed to install rsync. Build might fail if rsync is required."
  # Optionally, exit here if rsync is absolutely critical:
  # exit 1
fi
echo "---------------------------"

# --- Dependency Installation ---
if [ -f "package-lock.json" ]; then
  echo "Installing dependencies with npm ci..."
  npm ci
  echo "Installing platform-specific @rollup/rollup-linux-x64-gnu..."
  npm install --no-save @rollup/rollup-linux-x64-gnu
else
  echo "Installing dependencies with yarn..."
  yarn install --frozen-lockfile --non-interactive
  echo "Installing platform-specific @rollup/rollup-linux-x64-gnu..."
  yarn add --dev @rollup/rollup-linux-x64-gnu
fi

# --- Prepare for Chunked Build ---
echo "Running optimize-for-build.js script to prepare for chunked building..."
node scripts/optimize-for-build.js
if [ $? -ne 0 ]; then
  echo "Error: optimize-for-build.js script failed!"
  exit 1
fi

# --- Build Chunks --- 
echo "Starting chunked Astro build process..."
for i in $(seq 0 $((NUM_CHUNKS - 1)))
do
  echo ""
  echo "--- Building Chunk $((i + 1)) / $NUM_CHUNKS ---"
  export BUILD_PAGE_NUMBER=$i
  export PAGES_PER_BUILD=$PAGES_PER_BUILD
  
  echo "Environment for this chunk: BUILD_PAGE_NUMBER=$BUILD_PAGE_NUMBER, PAGES_PER_BUILD=$PAGES_PER_BUILD"
  echo "Cleaning previous chunk's dist directory..."
  rm -rf dist
  mkdir -p dist # Astro needs this to exist

  echo "Running Astro build for chunk $((i + 1))..."
  if NODE_OPTIONS="--max-old-space-size=4096" NODE_ENV=production npx astro build; then
    echo "Astro build for chunk $((i + 1)) completed successfully."
    
    echo "Moving contents of dist to $ACCUMULATED_DIST_DIR ..."
    # Astro output structure has client/server subdirs in `dist` for static output too.
    # We need to merge them carefully.
    mkdir -p "$ACCUMULATED_DIST_DIR/client"
    mkdir -p "$ACCUMULATED_DIST_DIR/server" # Though server might be empty for pure static
    
    # Use rsync for more robust copying and merging
    if [ -d "dist/client" ]; then
      rsync -av --ignore-existing dist/client/ "$ACCUMULATED_DIST_DIR/client/"
    fi
    if [ -d "dist/server" ]; then # For completeness, though likely empty for static
      rsync -av --ignore-existing dist/server/ "$ACCUMULATED_DIST_DIR/server/"
    fi
    # Copy other top-level files/dirs from dist (like index.html, 404.html, assets, etc.)
    # Exclude client/server as they are handled above.
    find dist -maxdepth 1 -mindepth 1 -not -name "client" -not -name "server" -exec rsync -av --ignore-existing {} "$ACCUMULATED_DIST_DIR/" \;

    echo "Contents of $ACCUMULATED_DIST_DIR after chunk $((i + 1)) :"
    ls -R "$ACCUMULATED_DIST_DIR"
    echo "Disk space after chunk $((i + 1)) build:"
    df -h
  else
    echo "Error: Astro build for chunk $((i + 1)) failed!"
    exit 1 # Exit on first chunk failure
  fi
done

# --- Post-Chunk Build Operations ---
echo "All chunks built. Restoring original files..."
if [ -f "./restore-files.sh" ]; then
  chmod +x ./restore-files.sh
  ./restore-files.sh
else
  echo "Warning: restore-files.sh not found. Original files might not be restored."
fi

# --- Finalize Output for Vercel ---
echo "Running post-build.js script to finalize output for Vercel from $ACCUMULATED_DIST_DIR..."
export SOURCE_DIST_DIR="$ACCUMULATED_DIST_DIR"
node scripts/post-build.js
if [ $? -ne 0 ]; then
  echo "Error: post-build.js script failed!"
  echo "Ensuring minimal Vercel config and fallback pages due to post-build.js error..."
  mkdir -p .vercel/output
  echo '{"version": 3, "routes": [{ "handle": "filesystem" }, { "src": "/.*", "status": 404, "dest": "/404.html" }], "cleanUrls": true}' > .vercel/output/config.json
  mkdir -p "$FINAL_VERCEL_OUTPUT_DIR"
  echo "<!DOCTYPE html><html><head><title>Site Update</title></head><body>Site is currently being updated. Please check back soon.</body></html>" > "$FINAL_VERCEL_OUTPUT_DIR/index.html"
  echo "<!DOCTYPE html><html><head><title>Not Found</title></head><body>404 - Page Not Found</body></html>" > "$FINAL_VERCEL_OUTPUT_DIR/404.html"
  exit 1
fi

# --- Final Report ---
echo "Disk usage after entire build process:"
df -h
if [ -d "$FINAL_VERCEL_OUTPUT_DIR" ]; then
  echo "Generated file count in $FINAL_VERCEL_OUTPUT_DIR:"
  find "$FINAL_VERCEL_OUTPUT_DIR" -type f | wc -l
else
  echo "Error: Final Vercel output directory $FINAL_VERCEL_OUTPUT_DIR not found or empty!"
  exit 1
fi

echo "Build process completed." 
