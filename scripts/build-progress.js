#!/usr/bin/env node

/**
 * Build progress monitor for Astro static site generation
 * Run this alongside the build process to see real-time build stats
 * Usage: npm run build:optimized & node scripts/build-progress.js
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Configuration
const REFRESH_INTERVAL = 2000; // 2 seconds
const LOG_DIR = './.vercel/output/_logs';
const BUILDINFO_FILE = './node_modules/.astro/build-info.json';

// Pretty formatting helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

// State variables
let startTime = Date.now();
let totalPages = 0;
let completedPages = 0;
let lastUpdateTime = 0;
let buildPhase = 'initializing';

// Initialize console display
function initDisplay() {
  console.clear();
  console.log(
    `${colors.bright}${colors.cyan}=======================================`
  );
  console.log(`       ASTRO BUILD PROGRESS MONITOR`);
  console.log(`=======================================${colors.reset}\n`);
}

// Format time in a human-readable format (HH:MM:SS)
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return `${hours.toString().padStart(2, '0')}:${(minutes % 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

// Format a progress bar
function progressBar(percent, width = 30) {
  const filled = Math.round(width * (percent / 100));
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${bar} ${percent.toFixed(1)}%`;
}

// Update the display with current progress
function updateDisplay() {
  // Calculate metrics
  const elapsed = Date.now() - startTime;
  const elapsedFormatted = formatTime(elapsed);

  const percentComplete =
    totalPages > 0 ? (completedPages / totalPages) * 100 : 0;

  // Calculate ETA if we have enough data
  let etaFormatted = 'Calculating...';
  if (completedPages > 0 && totalPages > 0) {
    const pagesPerMs = completedPages / elapsed;
    const remainingPages = totalPages - completedPages;
    const etaMs = remainingPages / pagesPerMs;
    etaFormatted = formatTime(etaMs);
  }

  // Calculate pages per minute
  const pagesPerMinute = (completedPages / (elapsed / 60000)).toFixed(1);

  // Clear the console and display the updated information
  console.clear();

  // Header
  console.log(
    `${colors.bright}${colors.cyan}=======================================`
  );
  console.log(`       ASTRO BUILD PROGRESS MONITOR`);
  console.log(`=======================================${colors.reset}\n`);

  // Current phase
  console.log(
    `${colors.bright}Current phase: ${colors.yellow}${buildPhase}${colors.reset}\n`
  );

  // Progress stats
  console.log(`${colors.bright}Progress:${colors.reset}`);
  console.log(`  ${progressBar(percentComplete)}`);
  console.log(
    `  Pages: ${colors.green}${completedPages}${colors.reset} / ${colors.yellow}${totalPages}${colors.reset}`
  );
  console.log(
    `  Rate: ${colors.cyan}${pagesPerMinute}${colors.reset} pages/minute\n`
  );

  // Time stats
  console.log(`${colors.bright}Time:${colors.reset}`);
  console.log(`  Elapsed: ${colors.green}${elapsedFormatted}${colors.reset}`);
  console.log(`  ETA: ${colors.yellow}${etaFormatted}${colors.reset}\n`);

  // Last update
  if (lastUpdateTime > 0) {
    const lastUpdateAgo = Math.floor((Date.now() - lastUpdateTime) / 1000);
    console.log(
      `${colors.dim}Last update: ${lastUpdateAgo}s ago${colors.reset}`
    );
  }
}

// Extract relevant information from logs
function processLogs() {
  try {
    // Check if build-info.json exists
    if (fs.existsSync(BUILDINFO_FILE)) {
      const buildInfo = JSON.parse(fs.readFileSync(BUILDINFO_FILE, 'utf8'));
      if (buildInfo?.cachedPages) {
        totalPages = Object.keys(buildInfo.cachedPages).length;
      }
    }

    // Check if log directory exists
    if (!fs.existsSync(LOG_DIR)) {
      return;
    }

    // Find the most recent log file
    const logFiles = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.endsWith('.log'))
      .map((f) => path.join(LOG_DIR, f));

    if (logFiles.length === 0) {
      return;
    }

    // Get the most recent log file
    const mostRecentLog = logFiles.reduce((latest, file) => {
      const stats = fs.statSync(file);
      return stats.mtime > fs.statSync(latest).mtime ? file : latest;
    }, logFiles[0]);

    // Read the log file
    const logContent = fs.readFileSync(mostRecentLog, 'utf8');

    // Extract build phase
    const phaseMatch = logContent.match(/Building ([a-zA-Z]+) pages/i);
    if (phaseMatch) {
      buildPhase = phaseMatch[1].toLowerCase();
    }

    // Count generated pages from log
    const generatedMatches = [...logContent.matchAll(/Generated (\d+) pages/g)];
    if (generatedMatches.length > 0) {
      // Use the latest match
      const latest = generatedMatches[generatedMatches.length - 1];
      completedPages = parseInt(latest[1], 10);
      lastUpdateTime = Date.now();
    }

    // If we don't find generated pages, check individual page creations
    if (completedPages === 0) {
      const individualPages = [
        ...logContent.matchAll(/(Generating|Generated) ([a-zA-Z0-9\-_\/]+)/g),
      ];
      completedPages = individualPages.length;
      if (completedPages > 0) {
        lastUpdateTime = Date.now();
      }
    }
  } catch (error) {
    console.error('Error processing logs:', error.message);
  }
}

// Main function
function main() {
  initDisplay();

  // Process logs immediately
  processLogs();
  updateDisplay();

  // Set up interval to refresh
  setInterval(() => {
    processLogs();
    updateDisplay();
  }, REFRESH_INTERVAL);

  // Handle graceful exit
  process.on('SIGINT', () => {
    console.clear();
    console.log(`\n${colors.green}Build monitor stopped.${colors.reset}`);
    process.exit(0);
  });
}

// Start the monitor
main();
