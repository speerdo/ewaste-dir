#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Check if Netlify functions directory exists
const functionsDir = path.join(process.cwd(), '.netlify/functions');

console.log('Checking Netlify functions...');

if (!fs.existsSync(functionsDir)) {
  console.error('❌ .netlify/functions directory not found!');
  process.exit(1);
}

// Check for entry.js function
const entryFunction = path.join(functionsDir, 'entry.js');
if (!fs.existsSync(entryFunction)) {
  console.error('❌ Main entry.js function not found!');
  process.exit(1);
}

// Check if the function contains references to API routes
const entryContent = fs.readFileSync(entryFunction, 'utf8');
if (!entryContent.includes('/api/')) {
  console.warn(
    '⚠️ entry.js function might not be handling API routes properly.'
  );
}

console.log('✅ Netlify functions directory found!');
console.log('✅ Main entry.js function found!');

// List all functions
const functions = fs.readdirSync(functionsDir);
console.log(
  `\nFound ${functions.length} functions in .netlify/functions/:`,
  functions
);

console.log('\nDone checking Netlify functions!');
