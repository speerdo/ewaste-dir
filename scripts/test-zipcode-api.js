#!/usr/bin/env node
/**
 * Test script for the ZIP code API
 *
 * Run with: node scripts/test-zipcode-api.js
 */

// Test multiple ZIP codes to ensure they work correctly
const testZips = ['10002', '90210', '60601', '20001', '98101'];
const baseUrl = process.env.API_URL || 'http://localhost:4321';

async function testZipCode(zip) {
  const url = `${baseUrl}/api/zipcode?zip=${zip}`;
  console.log(`Testing ZIP code ${zip}...`);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(
        `API request failed with status ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(
      `✅ ${zip} => ${data.city}, ${data.state} (source: ${
        data.source || 'unknown'
      })`
    );
    return true;
  } catch (error) {
    console.error(`❌ ${zip} Failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`Testing ZIP code API at ${baseUrl}...`);

  let successes = 0;
  let failures = 0;

  for (const zip of testZips) {
    const succeeded = await testZipCode(zip);
    if (succeeded) {
      successes++;
    } else {
      failures++;
    }
  }

  console.log('\n===== TEST SUMMARY =====');
  console.log(`Total tests: ${testZips.length}`);
  console.log(`Passed: ${successes}`);
  console.log(`Failed: ${failures}`);

  if (failures > 0) {
    console.log('\nAction needed:');
    console.log('1. Check if the API endpoint is accessible');
    console.log(
      '2. Verify the API route is correctly configured in astro.config.mjs'
    );
    console.log('3. Ensure the correct request headers are being sent');
    console.log('4. Check for CORS issues');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('Test script error:', error);
  process.exit(1);
});
