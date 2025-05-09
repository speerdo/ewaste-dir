#!/bin/bash

echo "Deploying to Netlify..."

# Install Netlify CLI if not present
if ! command -v netlify &> /dev/null; then
    echo "Installing Netlify CLI..."
    npm install -g netlify-cli
fi

# Clear dist directory first
echo "Cleaning up previous build..."
rm -rf dist/
rm -rf .netlify/functions/

# Install dependencies with the legacy-peer-deps flag to avoid conflicts
echo "Installing dependencies with legacy peer deps flag..."
npm install --legacy-peer-deps

# Build the project
echo "Building project..."
npm run build

# Deploy to Netlify
echo "Deploying to Netlify..."
netlify deploy --dir=dist --prod

echo "Deployment complete!" 
