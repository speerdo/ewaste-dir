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
const distDir = path.join(projectRoot, 'dist');
const vercelOutputDir = path.join(projectRoot, '.vercel', 'output', 'static');

console.log('Running post-build script to prepare deployment...');

// Ensure output directories exist
if (!fs.existsSync(path.dirname(vercelOutputDir))) {
  fs.mkdirSync(path.dirname(vercelOutputDir), { recursive: true });
}

if (!fs.existsSync(vercelOutputDir)) {
  fs.mkdirSync(vercelOutputDir, { recursive: true });
}

// Create a Vercel config file
const configDir = path.join(projectRoot, '.vercel', 'output');
const configPath = path.join(configDir, 'config.json');

const config = {
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '/.*', status: 404, dest: '/404.html' },
  ],
  cleanUrls: true,
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Created Vercel config.json');

// Check if dist directory exists - if not, create minimal files
if (!fs.existsSync(distDir) || fs.readdirSync(distDir).length === 0) {
  console.log(
    'Note: dist directory does not exist or is empty. Creating minimal content.'
  );

  createMinimalPage(
    path.join(vercelOutputDir, 'index.html'),
    'Recycle Old Tech',
    'The site is being updated. Please check back soon!'
  );
  createMinimalPage(
    path.join(vercelOutputDir, '404.html'),
    'Page Not Found',
    'The page you requested could not be found.'
  );

  console.log('Created minimal fallback pages');
} else {
  // Copy files from dist to .vercel/output/static
  try {
    console.log(`Copying files from ${distDir} to ${vercelOutputDir}...`);

    // First, remove any existing files in the target directory
    if (fs.existsSync(vercelOutputDir)) {
      const files = fs.readdirSync(vercelOutputDir);
      for (const file of files) {
        const filePath = path.join(vercelOutputDir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
    }

    // Now copy all files from dist to the target directory
    copyDirectorySync(distDir, vercelOutputDir);

    console.log('Files copied successfully!');

    // Count files to verify copy
    const fileCount = countFiles(vercelOutputDir);
    console.log(`Total files in output directory: ${fileCount}`);
  } catch (error) {
    console.error('Error copying files:', error);

    // Create fallback pages if copy fails
    createMinimalPage(
      path.join(vercelOutputDir, 'index.html'),
      'Recycle Old Tech',
      'The site is being updated. Please check back soon!'
    );
    createMinimalPage(
      path.join(vercelOutputDir, '404.html'),
      'Page Not Found',
      'The page you requested could not be found.'
    );

    console.log('Created minimal fallback pages due to error');
  }
}

// Helper function to create a minimal HTML page
function createMinimalPage(filePath, title, message) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 2rem;
      color: #333;
      text-align: center;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #166534;
    }
    p {
      font-size: 1.2rem;
      max-width: 500px;
      margin-bottom: 2rem;
    }
    a {
      color: #166534;
      text-decoration: none;
      border: 2px solid #166534;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-weight: 500;
      transition: all 0.2s;
    }
    a:hover {
      background: #166534;
      color: white;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="/">Home</a>
</body>
</html>`;

  fs.writeFileSync(filePath, html);
}

// Helper function to copy directories recursively
function copyDirectorySync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  if (!fs.existsSync(source)) {
    console.log(`Warning: Source directory ${source} does not exist`);
    return;
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectorySync(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// Helper function to count files in a directory recursively
function countFiles(directory) {
  let count = 0;

  if (!fs.existsSync(directory)) {
    return 0;
  }

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
