/**
 * Build optimization script
 *
 * This script helps break down the static generation into manageable chunks
 * to prevent memory issues when building a large number of pages
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up paths
const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectRoot = path.resolve(scriptDir, '..');
const pagesDir = path.join(projectRoot, 'src', 'pages');
const tempDir = path.join(projectRoot, '.temp-build');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log('Build optimization: Analyzing routes...');

// Target dynamic route files that generate many pages
const dynamicRouteFiles = [
  path.join(pagesDir, 'states', '[state]', '[city].astro'),
  path.join(pagesDir, 'states', '[state]', 'index.astro'),
];

// Create backups of each target file
dynamicRouteFiles.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    const fileName = path.basename(filePath);
    const backupPath = path.join(tempDir, fileName);
    console.log(`Backing up ${fileName}...`);
    fs.copyFileSync(filePath, backupPath);
  }
});

// Modify city pages to use chunked builds
const cityFilePath = path.join(pagesDir, 'states', '[state]', '[city].astro');
if (fs.existsSync(cityFilePath)) {
  console.log('Optimizing city pages for chunked builds...');

  let content = fs.readFileSync(cityFilePath, 'utf8');

  // Add pagination support to getStaticPaths function
  content = content.replace(
    /export async function getStaticPaths\(\) {/,
    `export async function getStaticPaths({ paginate }) {
  // Get the page number from environment or default to building all
  const PAGE_TO_BUILD = process.env.BUILD_PAGE_NUMBER ? parseInt(process.env.BUILD_PAGE_NUMBER, 10) : undefined;
  const PAGES_PER_BUILD = process.env.PAGES_PER_BUILD ? parseInt(process.env.PAGES_PER_BUILD, 10) : 2000;`
  );

  // Update the path generation to use pagination chunks
  content = content.replace(
    /return paths\.flat\(\);/,
    `const allPaths = paths.flat();
  
  // If we're in a chunked build, only return the specified chunk
  if (PAGE_TO_BUILD !== undefined) {
    const startIdx = PAGE_TO_BUILD * PAGES_PER_BUILD;
    const endIdx = startIdx + PAGES_PER_BUILD;
    console.log(\`Building city pages chunk \${PAGE_TO_BUILD}: \${startIdx} to \${endIdx} (of \${allPaths.length})\`);
    return allPaths.slice(startIdx, endIdx);
  }
  
  // Otherwise return all paths
  return allPaths;`
  );

  fs.writeFileSync(cityFilePath, content);
}

// Create a script to restore original files after build
const restoreScript = `#!/bin/bash
echo "Restoring original dynamic route files..."
for file in .temp-build/*; do
  filename=$(basename "$file")
  if [[ "$filename" == *"[state]"* ]]; then
    cp "$file" "src/pages/states/[state]/$filename"
    echo "Restored $filename"
  fi
done
echo "Cleanup complete."
`;

const restoreScriptPath = path.join(projectRoot, 'restore-files.sh');
fs.writeFileSync(restoreScriptPath, restoreScript);
fs.chmodSync(restoreScriptPath, '755');

console.log(
  'Build optimization complete. The build will now process pages in smaller batches.'
);
console.log(
  'To rebuild with original files after completion, run: ./restore-files.sh'
);
