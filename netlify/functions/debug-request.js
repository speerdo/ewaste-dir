// Debug request handler
exports.handler = async (event, context) => {
  // Get useful information from the event
  const {
    path,
    httpMethod,
    headers,
    queryStringParameters,
    body,
    isBase64Encoded,
  } = event;

  // Log all request details
  console.log('Debug function called with path:', path);
  console.log('HTTP Method:', httpMethod);
  console.log('Headers:', JSON.stringify(headers, null, 2));
  console.log('Query params:', queryStringParameters);

  // Format the response with all details
  const responseBody = {
    message: 'Debug information for Netlify function',
    timestamp: new Date().toISOString(),
    request: {
      path,
      httpMethod,
      queryStringParameters: queryStringParameters || {},
      headers,
      hasBody: !!body,
      bodyIsBase64: isBase64Encoded,
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      CONTEXT: process.env.CONTEXT,
      NETLIFY: process.env.NETLIFY,
      NETLIFY_DEV: process.env.NETLIFY_DEV,
      NETLIFY_IMAGES_CDN_DOMAIN: process.env.NETLIFY_IMAGES_CDN_DOMAIN,
    },
    functionDetails: {
      name: context.functionName,
      functionPath: __filename,
      dir: __dirname,
    },
  };

  // Return details to caller
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Info': 'Netlify Function Debug Response',
    },
    body: JSON.stringify(responseBody, null, 2),
  };
};
