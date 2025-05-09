const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const glob = promisify(require('glob'));
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const rename = promisify(fs.rename);
const exists = promisify(fs.exists);
const mkdirp = promisify(require('mkdirp'));

// Function to fix any invalid function names
async function fixInvalidFunctionNames(functionDir) {
  console.log(`Checking for invalid function names in ${functionDir}`);

  try {
    // Find any files with @ in their name
    const invalidFiles = await glob('**/*@*', { cwd: functionDir });

    console.log(`Found ${invalidFiles.length} files with invalid characters`);

    for (const file of invalidFiles) {
      const oldPath = path.join(functionDir, file);
      const newPath = path.join(
        path.dirname(oldPath),
        path.basename(oldPath).replace(/[^a-zA-Z0-9\-_\.]/g, '_')
      );

      console.log(`Renaming ${oldPath} to ${newPath}`);

      // Rename the file
      await rename(oldPath, newPath);

      // Update any references to this file
      const jsFiles = await glob('**/*.{js,mjs}', { cwd: functionDir });

      for (const jsFile of jsFiles) {
        const jsPath = path.join(functionDir, jsFile);
        const content = await readFile(jsPath, 'utf8');

        // Look for references to the renamed file
        const oldBasename = path.basename(oldPath);
        const newBasename = path.basename(newPath);

        const updatedContent = content.replace(
          new RegExp(
            oldBasename.replace(/\./g, '\\.').replace(/\@/g, '\\@'),
            'g'
          ),
          newBasename
        );

        if (content !== updatedContent) {
          console.log(`Updating references in ${jsPath}`);
          await writeFile(jsPath, updatedContent, 'utf8');
        }
      }
    }

    // Create a direct replacement for _@astrojs-ssr-adapter.js
    const ssrAdapterPath = path.join(functionDir, '_@astrojs-ssr-adapter.js');
    const replacementPath = path.join(functionDir, '_astrojs-ssr-adapter.js');

    if ((await exists(ssrAdapterPath)) && !(await exists(replacementPath))) {
      console.log(`Creating direct replacement for ${ssrAdapterPath}`);

      const content = `
// Direct replacement for _@astrojs-ssr-adapter.js
// This file has a valid name that Netlify can deploy

// Import the handler from the renamed file
exports.handler = async function(event, context) {
  try {
    // Try to import the handler from various possible locations
    let ssrHandler;
    
    try {
      // Try importing from renamed file
      const renamed = require('./__astrojs-ssr-adapter.mjs');
      ssrHandler = renamed.handler;
    } catch (err1) {
      console.log('Failed to import from renamed file, trying entry.mjs');
      try {
        // Try importing from entry.mjs
        const entry = require('./entry.mjs');
        ssrHandler = entry.handler;
      } catch (err2) {
        console.log('Failed to import from entry.mjs, trying direct adapter import');
        try {
          // Try direct path to our own ssr.js file
          const ssr = require('./ssr');
          ssrHandler = ssr.handler;
        } catch (err3) {
          throw new Error('Failed to import handler from any location');
        }
      }
    }
    
    // Call the handler
    return await ssrHandler(event, context);
  } catch (error) {
    console.error('Error in _astrojs-ssr-adapter:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to process the request'
      })
    };
  }
};
`;

      await writeFile(replacementPath, content, 'utf8');
    }

    return true;
  } catch (error) {
    console.error('Error fixing function names:', error);
    return false;
  }
}

module.exports = {
  onPostBuild: async ({ constants, utils }) => {
    const { FUNCTIONS_SRC, FUNCTIONS_DIST } = constants;

    console.log('Running function name fix plugin');

    // Check both source and dist function directories
    if (FUNCTIONS_SRC) {
      await fixInvalidFunctionNames(FUNCTIONS_SRC);
    }

    if (FUNCTIONS_DIST) {
      await fixInvalidFunctionNames(FUNCTIONS_DIST);
    }

    // Also check .netlify/functions directory
    const siteRoot = process.cwd();
    const netlifyFunctionsDir = path.join(siteRoot, '.netlify', 'functions');

    if (await exists(netlifyFunctionsDir)) {
      await fixInvalidFunctionNames(netlifyFunctionsDir);
    }

    console.log('Function name fix plugin completed');
  },
};
