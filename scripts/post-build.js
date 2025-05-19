/**
 * Post-build script to ensure files are in the correct directory structure for Vercel
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up paths
const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectRoot = path.resolve(scriptDir, '..');

// Use environment variable for source dist, otherwise default to ./dist
const sourceDistDirName = process.env.SOURCE_DIST_DIR || 'dist';
const sourceDistPath = path.join(projectRoot, sourceDistDirName);

const vercelOutputDir = path.join(projectRoot, '.vercel', 'output', 'static');

console.log(
  `Running post-build script. Source: ${sourceDistPath}, Target: ${vercelOutputDir}`
);

// Ensure Vercel output directories exist
if (!fs.existsSync(path.dirname(vercelOutputDir))) {
  fs.mkdirSync(path.dirname(vercelOutputDir), { recursive: true });
}
if (!fs.existsSync(vercelOutputDir)) {
  fs.mkdirSync(vercelOutputDir, { recursive: true });
}

// Create a Vercel config.json file
const configDir = path.join(projectRoot, '.vercel', 'output');
const configPath = path.join(configDir, 'config.json');
const vercelConfig = {
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '/.*', status: 404, dest: '/404.html' }, // Assumes 404.html exists in static output
  ],
  cleanUrls: true,
};
fs.writeFileSync(configPath, JSON.stringify(vercelConfig, null, 2));
console.log(`Created Vercel config.json at ${configPath}`);

// Check if source directory exists - if not, create minimal files
if (
  !fs.existsSync(sourceDistPath) ||
  fs.readdirSync(sourceDistPath).length === 0
) {
  console.warn(
    `Warning: Source directory ${sourceDistPath} does not exist or is empty. Creating minimal fallback content in ${vercelOutputDir}.`
  );
  createMinimalPage(
    path.join(vercelOutputDir, 'index.html'),
    'Recycle Old Tech',
    'The site is currently being updated. Please check back soon!'
  );
  createMinimalPage(
    path.join(vercelOutputDir, '404.html'),
    'Page Not Found',
    'The page you requested could not be found.'
  );
  console.log('Created minimal fallback pages.');
} else {
  // Copy files from source (e.g., accumulated dist) to .vercel/output/static
  try {
    console.log(
      `Copying files from ${sourceDistPath} to ${vercelOutputDir}...`
    );

    // Clean the target directory before copying
    if (fs.existsSync(vercelOutputDir)) {
      const files = fs.readdirSync(vercelOutputDir);
      for (const file of files) {
        const filePath = path.join(vercelOutputDir, file);
        // Be careful not to delete the .vercel/output/config.json if it's somehow in here
        if (file !== 'config.json') {
          if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
      }
    }
    // Recopy just in case it was cleaned
    fs.writeFileSync(configPath, JSON.stringify(vercelConfig, null, 2));

    copyDirectorySync(sourceDistPath, vercelOutputDir);
    console.log('Files copied successfully!');

    const fileCount = countFiles(vercelOutputDir);
    console.log(
      `Total files in output directory ${vercelOutputDir}: ${fileCount}`
    );

    // Ensure a 404.html exists if not copied, for the Vercel route to work
    if (!fs.existsSync(path.join(vercelOutputDir, '404.html'))) {
      console.log('404.html not found in output, creating a minimal one.');
      createMinimalPage(
        path.join(vercelOutputDir, '404.html'),
        'Page Not Found',
        'The page you requested could not be found.'
      );
    }
  } catch (error) {
    console.error('Error during file operations in post-build.js:', error);
    console.warn(
      `Creating minimal fallback content in ${vercelOutputDir} due to error.`
    );
    createMinimalPage(
      path.join(vercelOutputDir, 'index.html'),
      'Recycle Old Tech',
      'Site update in progress. Please check back soon.'
    );
    createMinimalPage(
      path.join(vercelOutputDir, '404.html'),
      'Page Not Found',
      'The requested page was not found.'
    );
  }
}

function createMinimalPage(filePath, title, message) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:2rem;color:#333;text-align:center}h1{font-size:2rem;margin-bottom:1rem;color:#166534}p{font-size:1.2rem;max-width:500px;margin-bottom:2rem}a{color:#166534;text-decoration:none;border:2px solid #166534;padding:.5rem 1rem;border-radius:4px;font-weight:500;transition:all .2s}a:hover{background:#166534;color:#fff}</style></head><body><h1>${title}</h1><p>${message}</p><a href="/">Home</a></body></html>`;
  try {
    fs.writeFileSync(filePath, html);
  } catch (writeError) {
    console.error(`Failed to write minimal page ${filePath}:`, writeError);
  }
}

function copyDirectorySync(source, target) {
  if (!fs.existsSync(source)) {
    console.warn(
      `Warning: Source directory for copy ${source} does not exist.`
    );
    return;
  }
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectorySync(sourcePath, targetPath);
    } else {
      try {
        fs.copyFileSync(sourcePath, targetPath);
      } catch (copyError) {
        console.error(
          `Failed to copy file ${sourcePath} to ${targetPath}:`,
          copyError
        );
      }
    }
  }
}

function countFiles(directory) {
  let count = 0;
  if (!fs.existsSync(directory)) return 0;
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(entryPath);
    } else {
      count++;
    }
  }
  return count;
}

console.log('Post-build script finished.');
