#!/usr/bin/env node
/**
 * Test script for the ZIP code API
 *
 * Run with: node scripts/test-zipcode-api.js
 */

// Test multiple ZIP codes to ensure they work correctly
const testZips = [
  // NYC special cases
  { zip: '10001', expectedCity: 'New York', expectedState: 'New York' },
  { zip: '10002', expectedCity: 'New York', expectedState: 'New York' },

  // Beverly Hills special case
  { zip: '90210', expectedCity: 'Beverly Hills', expectedState: 'California' },

  // Major cities
  { zip: '60601', expectedCity: 'Chicago', expectedState: 'Illinois' },
  {
    zip: '20001',
    expectedCity: 'Washington',
    expectedState: 'District of Columbia',
  },
  { zip: '98101', expectedCity: 'Seattle', expectedState: 'Washington' },

  // Edge cases
  { zip: '33139', expectedCity: 'Miami Beach', expectedState: 'Florida' }, // Should map to Miami
  { zip: '11201', expectedCity: 'Brooklyn', expectedState: 'New York' }, // NYC borough
];

const baseUrl = process.env.API_URL || 'http://localhost:4321';

async function testZipCode(testCase) {
  const url = `${baseUrl}/api/zipcode?zip=${testCase.zip}`;
  console.log(`Testing ZIP code ${testCase.zip}...`);

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

    // Basic validation
    if (!data.city || !data.state) {
      throw new Error(`Missing city or state in response for ${testCase.zip}`);
    }

    // Check coordinates
    if (!data.coordinates || !data.coordinates.lat || !data.coordinates.lng) {
      console.warn(`⚠️ Missing coordinates for ${testCase.zip}`);
    }

    // Check expected values
    const cityMatches =
      data.city.toLowerCase() === testCase.expectedCity.toLowerCase();
    const stateMatches =
      data.state.toLowerCase() === testCase.expectedState.toLowerCase();

    if (cityMatches && stateMatches) {
      console.log(
        `✅ ${testCase.zip} => ${data.city}, ${data.state} (source: ${
          data.source || 'unknown'
        })`
      );
      return { success: true, data };
    } else {
      console.error(
        `❌ ${testCase.zip} => ${data.city}, ${data.state} ` +
          `EXPECTED: ${testCase.expectedCity}, ${testCase.expectedState}`
      );
      return {
        success: false,
        data,
        expected: {
          city: testCase.expectedCity,
          state: testCase.expectedState,
        },
      };
    }
  } catch (error) {
    console.error(`❌ ${testCase.zip} Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log(`Testing ZIP code API at ${baseUrl}...`);

  let successes = 0;
  let failures = 0;
  const results = [];

  for (const testCase of testZips) {
    const result = await testZipCode(testCase);
    results.push({
      zip: testCase.zip,
      ...result,
    });

    if (result.success) {
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
    console.log('\nFailed tests:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(
          `- ZIP ${r.zip}: ${
            r.error ||
            `Got ${r.data.city}, ${r.data.state} instead of ${r.expected.city}, ${r.expected.state}`
          }`
        );
      });

    console.log('\nAction needed:');
    console.log('1. Check if the API endpoint is accessible');
    console.log('2. Check the special case handling in the zipcode.ts file');
    console.log('3. Verify all NYC and borough ZIP codes map to New York City');
    console.log('4. Ensure the fallback mechanism is working correctly');
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
