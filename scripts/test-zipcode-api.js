#!/usr/bin/env node
/**
 * Test script for the ZIP code API
 *
 * This script tests the ZIP code API with a set of test cases to ensure
 * it's returning the expected results.
 */

const baseUrl = process.env.API_URL || 'http://localhost:4321';
import chalk from 'chalk';

// Test cases for ZIP codes
const testCases = [
  // Test common ZIP codes with direct database matches
  {
    zip: '10001',
    expectedCity: 'New York',
    expectedState: 'new-york',
    note: 'Manhattan',
  },
  {
    zip: '90001',
    expectedCity: 'Los Angeles',
    expectedState: 'california',
    note: 'LA',
  },
  {
    zip: '60601',
    expectedCity: 'Chicago',
    expectedState: 'illinois',
    note: 'Chicago',
  },

  // Test edge cases that previously had issues
  {
    zip: '90210',
    expectedCity: 'Beverly Hills',
    expectedState: 'california',
    note: 'Beverly Hills (edge case)',
  },
  {
    zip: '90077',
    expectedCity: 'Los Angeles',
    expectedState: 'california',
    note: 'Bel Air (LA area)',
  },
  {
    zip: '33140',
    expectedCity: 'Miami',
    expectedState: 'florida',
    note: 'Miami Beach',
  },
  {
    zip: '10012',
    expectedCity: 'New York',
    expectedState: 'new-york',
    note: 'SoHo',
  },

  // Test ZIP codes that might require region-based fallback
  {
    zip: '94110',
    expectedCity: 'San Francisco',
    expectedState: 'california',
    note: 'San Francisco Mission',
  },
  {
    zip: '98101',
    expectedCity: 'Seattle',
    expectedState: 'washington',
    note: 'Seattle',
  },
  {
    zip: '89109',
    expectedCity: 'Las Vegas',
    expectedState: 'nevada',
    note: 'Las Vegas Strip',
  },
  {
    zip: '20500',
    expectedCity: 'Washington',
    expectedState: 'district-of-columbia',
    note: 'White House',
  },

  // Test pattern-based lookups for less common areas
  {
    zip: '02108',
    expectedCity: 'Boston',
    expectedState: 'massachusetts',
    note: 'Boston',
  },
  {
    zip: '80202',
    expectedCity: 'Denver',
    expectedState: 'colorado',
    note: 'Denver',
  },
  {
    zip: '75201',
    expectedCity: 'Dallas',
    expectedState: 'texas',
    note: 'Dallas',
  },
  {
    zip: '77002',
    expectedCity: 'Houston',
    expectedState: 'texas',
    note: 'Houston',
  },
  {
    zip: '48226',
    expectedCity: 'Detroit',
    expectedState: 'michigan',
    note: 'Detroit',
  },

  // Borough tests for NYC
  {
    zip: '11201',
    expectedCity: 'Brooklyn',
    expectedState: 'new-york',
    note: 'Brooklyn',
  },
  {
    zip: '10458',
    expectedCity: 'Bronx',
    expectedState: 'new-york',
    note: 'Bronx',
  },
  {
    zip: '11432',
    expectedCity: 'Queens',
    expectedState: 'new-york',
    note: 'Queens',
  },
  {
    zip: '10301',
    expectedCity: 'Staten Island',
    expectedState: 'new-york',
    note: 'Staten Island',
  },

  // Test non-existent or invalid ZIPs
  {
    zip: '00000',
    expectedCity: 'New York',
    expectedState: 'new-york',
    note: 'Invalid ZIP - should fallback',
  },
  {
    zip: '99999',
    expectedCity: 'Seattle',
    expectedState: 'washington',
    note: 'Non-existent ZIP - should use region',
  },
];

async function testZipCode(testCase) {
  const url = `${baseUrl}/api/zipcode?zip=${testCase.zip}`;
  console.log(
    `Testing ZIP code ${testCase.zip}${
      testCase.note ? ` (${testCase.note})` : ''
    }...`
  );

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
    console.log(`  Response source: ${data.source || 'unknown'}`);

    // Basic validation
    if (!data.city || !data.state) {
      throw new Error(`Missing city or state in response for ${testCase.zip}`);
    }

    // Check coordinates
    if (!data.coordinates || !data.coordinates.lat || !data.coordinates.lng) {
      console.warn(chalk.yellow(`⚠️ Missing coordinates for ${testCase.zip}`));
    }

    // Check expected values
    const cityMatches =
      data.city.toLowerCase() === testCase.expectedCity.toLowerCase();
    const stateMatches =
      data.state.toLowerCase() === testCase.expectedState.toLowerCase();

    if (cityMatches && stateMatches) {
      console.log(
        chalk.green(
          `✅ ${testCase.zip} => ${data.city}, ${data.state} (source: ${
            data.source || 'unknown'
          })`
        )
      );
      return { success: true, data };
    } else {
      console.error(
        chalk.red(
          `❌ ${testCase.zip} => ${data.city}, ${data.state} ` +
            `EXPECTED: ${testCase.expectedCity}, ${testCase.expectedState}`
        )
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
    console.error(chalk.red(`❌ ${testCase.zip} Failed: ${error.message}`));
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log(
    chalk.blue(`\n🚀 Starting ZIP code API tests against ${baseUrl}\n`)
  );

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await testZipCode(testCase);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  }

  // Summary
  console.log(chalk.blue('\n===== Test Summary ====='));
  console.log(`Total tests: ${testCases.length}`);
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));

  // Exit with appropriate code
  if (failed > 0) {
    console.log(
      chalk.yellow(
        '\n⚠️ Some tests failed. Check the output above for details.'
      )
    );
    process.exit(1);
  } else {
    console.log(chalk.green('\n🎉 All tests passed!'));
    process.exit(0);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error(chalk.red(`Error running tests: ${error.message}`));
  process.exit(1);
});
