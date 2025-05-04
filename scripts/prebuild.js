/**
 * Pre-build script to warm up caches and prefetch data before the full Astro build
 * Run this script before building to reduce memory pressure during the main build
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Missing Supabase credentials. Skipping prebuild optimization.\n' +
      'To enable full pre-build optimization, set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY environment variables.\n' +
      'Continuing with regular build...\n'
  );
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

async function prebuild() {
  if (!supabase) {
    console.log(
      'Skipping prebuild data prefetching due to missing credentials.'
    );
    return;
  }

  console.log(
    '🔄 Running prebuild script to warm up caches and prefetch data...'
  );

  try {
    // 1. Prefetch all states
    console.log('📊 Prefetching states...');
    const { data: states, error: statesError } = await supabase
      .from('states')
      .select('name')
      .order('name');

    if (statesError) {
      throw statesError;
    }

    console.log(`✅ Prefetched ${states.length} states`);

    // 2. Get a count of cities and pages we'll be generating
    console.log('📊 Calculating total city pages...');

    let totalCities = 0;
    let totalCenters = 0;

    // Process each state to get city counts
    for (const state of states) {
      // Get cities for this state
      const { data: centers, error: centersError } = await supabase
        .from('recycling_centers')
        .select('city, state')
        .eq('state', state.name)
        .not('city', 'is', null);

      if (centersError) {
        console.warn(
          `⚠️ Error fetching cities for ${state.name}:`,
          centersError
        );
        continue;
      }

      // Count unique cities
      const uniqueCities = new Set();
      centers.forEach((center) => {
        if (center.city) {
          uniqueCities.add(center.city);
        }
      });

      console.log(
        `  - ${state.name}: ${uniqueCities.size} cities, ${centers.length} centers`
      );
      totalCities += uniqueCities.size;
      totalCenters += centers.length;
    }

    // 3. Calculate and display build statistics
    console.log('\n📋 Build Statistics:');
    console.log(`  - Total States: ${states.length}`);
    console.log(`  - Total Cities: ${totalCities}`);
    console.log(`  - Total Centers: ${totalCenters}`);
    console.log(
      `  - Total Pages: ${
        states.length + totalCities + 1
      } (states + cities + home)`
    );

    // 4. Estimate build time
    const estimatedSecondsPerPage = 0.5;
    const estimatedMinutes = Math.ceil(
      ((states.length + totalCities) * estimatedSecondsPerPage) / 60
    );
    console.log(`\n⏱️ Estimated build time: ~${estimatedMinutes} minutes`);

    console.log(
      '\n✅ Prebuild completed successfully! Ready to run the main build.'
    );
  } catch (error) {
    console.error('❌ Prebuild failed:', error);
    console.log('Continuing with regular build...');
  }
}

// Run the prebuild process
prebuild();
