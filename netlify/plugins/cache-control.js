// Cache control plugin for Netlify
module.exports = {
  onPostBuild: ({ constants, utils }) => {
    console.log('Adding cache-control headers for API routes...');

    // Create custom headers for API routes
    const apiHeaders = `
# Custom cache settings for API routes
/api/*
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
  Surrogate-Control: no-store
  Pragma: no-cache
    `.trim();

    try {
      // Create headers file
      const headersPath = `${constants.PUBLISH_DIR}/_headers`;
      utils.status.info(`Writing _headers file to control caching`);

      // Check if file exists and append
      if (utils.fs.existsSync(headersPath)) {
        const existingHeaders = utils.fs.readFileSync(headersPath, 'utf8');
        utils.fs.writeFileSync(
          headersPath,
          `${existingHeaders}\n\n${apiHeaders}`
        );
      } else {
        utils.fs.writeFileSync(headersPath, apiHeaders);
      }

      utils.status.success(`Added cache-control headers for API routes`);
    } catch (error) {
      utils.status.error(`Error setting cache headers: ${error.message}`);
    }
  },
};
