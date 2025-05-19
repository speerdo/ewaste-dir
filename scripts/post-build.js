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

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist! Build may have failed.');
  process.exit(1);
}

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

  // Create a configuration file for Vercel
  createVercelConfig();
} catch (error) {
  console.error('Error copying files:', error);
  process.exit(1);
}

// Helper function to copy directories recursively
function copyDirectorySync(source, target) {
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
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// Helper function to count files in a directory recursively
function countFiles(directory) {
  let count = 0;
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

// Create a config.json file for Vercel
function createVercelConfig() {
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
}
