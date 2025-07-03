import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client with service role key for deletions
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure PUBLIC_SUPABASE_SERVICE_ROLE_KEY is set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function comprehensiveCleanup() {
  console.log('🚀 Starting comprehensive database cleanup...\n');

  try {
    // Step 1: Get initial counts
    console.log('📊 Getting initial database statistics...');
    const { data: initialCount } = await supabase
      .from('recycling_centers')
      .select('id', { count: 'exact', head: true });

    console.log(
      `Initial recycling centers: ${initialCount?.length || 'unknown'}\n`
    );

    // Step 2: Identify problematic entries to remove
    console.log('🔍 Identifying problematic entries...');

    // Define problematic patterns to remove
    const problematicPatterns = [
      {
        name: 'Walmart stores',
        patterns: ['%walmart%'],
        reason: 'Retail chain, not recycling centers',
      },
      {
        name: 'Auto-related businesses',
        patterns: ['%auto%'],
        reason: 'Auto recycling, not electronics',
      },
      {
        name: 'CVS/Pharmacy stores',
        patterns: ['%cvs%', '%pharmacy%'],
        reason: 'Pharmacies dont recycle electronics',
      },
      {
        name: 'Inappropriate businesses',
        patterns: [
          '%vape%',
          '%smoke%',
          '%funeral%',
          '%restaurant%',
          '%hotel%',
          '%bank%',
          '%dental%',
          '%medical%',
          '%plumbing%',
          '%hvac%',
        ],
        reason: 'Clearly not electronics recycling',
      },
    ];

    let allProblematicIds = [];
    let backupData = [];

    for (const category of problematicPatterns) {
      console.log(`  Checking ${category.name}...`);

      let categoryResults = [];

      // Check each pattern for this category
      for (const pattern of category.patterns) {
        const { data, error } = await supabase
          .from('recycling_centers')
          .select('*')
          .filter('legitimacy_score', 'is', null)
          .ilike('name', pattern);

        if (error) throw error;

        if (data && data.length > 0) {
          categoryResults.push(...data);
        }
      }

      // Remove duplicates within this category
      const uniqueResults = categoryResults.filter(
        (item, index, self) => index === self.findIndex((t) => t.id === item.id)
      );

      console.log(`    Found ${uniqueResults.length} ${category.name}`);

      if (uniqueResults.length > 0) {
        const ids = uniqueResults.map((item) => item.id);
        allProblematicIds.push(...ids);
        backupData.push({
          category: category.name,
          reason: category.reason,
          count: uniqueResults.length,
          data: uniqueResults,
        });
      }
    }

    // Remove duplicates from IDs
    const uniqueProblematicIds = [...new Set(allProblematicIds)];

    console.log(`\n📋 Summary of problematic entries:`);
    backupData.forEach((backup) => {
      console.log(
        `  ${backup.category}: ${backup.count} entries - ${backup.reason}`
      );
    });
    console.log(
      `  TOTAL UNIQUE ENTRIES TO REMOVE: ${uniqueProblematicIds.length}\n`
    );

    if (uniqueProblematicIds.length === 0) {
      console.log('✅ No problematic entries found. Database is clean!');
      return;
    }

    // Step 3: Create backup file
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFilename = `backup-comprehensive-cleanup-${timestamp}.json`;

    console.log(`💾 Creating backup file: ${backupFilename}`);
    fs.writeFileSync(
      backupFilename,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          totalRemoved: uniqueProblematicIds.length,
          categories: backupData,
        },
        null,
        2
      )
    );

    // Step 4: Get cities before deletion to identify orphans later
    console.log('🏙️ Getting current city distribution...');
    const { data: citiesBeforeDeletion, error: citiesError } = await supabase
      .from('recycling_centers')
      .select('city, state')
      .not('city', 'is', null)
      .not('state', 'is', null);

    if (citiesError) throw citiesError;

    const citiesBeforeSet = new Set(
      citiesBeforeDeletion.map((center) => `${center.city}, ${center.state}`)
    );

    console.log(
      `Cities with recycling centers before cleanup: ${citiesBeforeSet.size}`
    );

    // Step 5: Delete problematic entries
    console.log(
      `🗑️ Removing ${uniqueProblematicIds.length} problematic entries...`
    );

    // Delete in batches to avoid query limits
    const batchSize = 100;
    let totalDeleted = 0;

    for (let i = 0; i < uniqueProblematicIds.length; i += batchSize) {
      const batch = uniqueProblematicIds.slice(i, i + batchSize);

      const { error: deleteError } = await supabase
        .from('recycling_centers')
        .delete()
        .in('id', batch);

      if (deleteError) throw deleteError;

      totalDeleted += batch.length;
      console.log(
        `  Deleted batch ${Math.ceil((i + 1) / batchSize)} of ${Math.ceil(
          uniqueProblematicIds.length / batchSize
        )} (${totalDeleted}/${uniqueProblematicIds.length})`
      );
    }

    // Step 6: Get cities after deletion to identify orphans
    console.log('\n🔍 Identifying orphaned cities...');
    const { data: citiesAfterDeletion, error: citiesAfterError } =
      await supabase
        .from('recycling_centers')
        .select('city, state')
        .not('city', 'is', null)
        .not('state', 'is', null);

    if (citiesAfterError) throw citiesAfterError;

    const citiesAfterSet = new Set(
      citiesAfterDeletion.map((center) => `${center.city}, ${center.state}`)
    );

    const orphanedCities = Array.from(citiesBeforeSet).filter(
      (city) => !citiesAfterSet.has(city)
    );

    console.log(
      `Cities with recycling centers after cleanup: ${citiesAfterSet.size}`
    );
    console.log(
      `Orphaned cities (no longer have recycling centers): ${orphanedCities.length}`
    );

    if (orphanedCities.length > 0) {
      console.log('\nOrphaned cities:');
      orphanedCities.forEach((city) => console.log(`  - ${city}`));
    }

    // Step 7: Clean up orphaned cities from related tables
    if (orphanedCities.length > 0) {
      console.log('\n🧹 Cleaning up orphaned cities from related tables...');

      const relatedTables = [
        'local_regulations',
        'city_stats',
        'local_content',
      ];

      for (const tableName of relatedTables) {
        console.log(`  Checking ${tableName}...`);

        // Get count before cleanup
        const { data: beforeData, error: beforeError } = await supabase
          .from(tableName)
          .select('city_state', { count: 'exact' })
          .in('city_state', orphanedCities);

        if (beforeError) {
          console.log(
            `    ⚠️ Error checking ${tableName}: ${beforeError.message}`
          );
          continue;
        }

        const beforeCount = beforeData?.length || 0;
        console.log(
          `    Found ${beforeCount} orphaned entries in ${tableName}`
        );

        if (beforeCount > 0) {
          // Delete orphaned entries
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .in('city_state', orphanedCities);

          if (deleteError) {
            console.log(
              `    ❌ Error deleting from ${tableName}: ${deleteError.message}`
            );
          } else {
            console.log(
              `    ✅ Removed ${beforeCount} orphaned entries from ${tableName}`
            );
          }
        }
      }
    }

    // Step 8: Final verification
    console.log('\n📊 Final database statistics:');

    // Get total count
    const { count: finalCount, error: countError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Get all legitimacy scores for distribution analysis
    const { data: scoredEntries, error: scoresError } = await supabase
      .from('recycling_centers')
      .select('legitimacy_score')
      .not('legitimacy_score', 'is', null);

    if (scoresError) throw scoresError;

    console.log(`Final recycling centers: ${finalCount}`);
    console.log(`Total removed: ${totalDeleted}`);
    console.log(`Orphaned cities cleaned: ${orphanedCities.length}`);

    if (scoredEntries && scoredEntries.length > 0) {
      const scored = scoredEntries.length;
      const unscored = finalCount - scored;

      console.log(`Scored entries: ${scored}`);
      console.log(`Unscored entries: ${unscored}`);

      const highQuality = scoredEntries.filter(
        (entry) => entry.legitimacy_score >= 50
      ).length;
      const mediumQuality = scoredEntries.filter(
        (entry) => entry.legitimacy_score >= 35 && entry.legitimacy_score < 50
      ).length;
      const lowQuality = scoredEntries.filter(
        (entry) => entry.legitimacy_score >= 25 && entry.legitimacy_score < 35
      ).length;
      const veryLowQuality = scoredEntries.filter(
        (entry) => entry.legitimacy_score < 25
      ).length;

      console.log(
        `High quality (50+): ${highQuality} (${(
          (highQuality / finalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `Medium quality (35-49): ${mediumQuality} (${(
          (mediumQuality / finalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `Low quality (25-34): ${lowQuality} (${(
          (lowQuality / finalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `Very low quality (<25): ${veryLowQuality} (${(
          (veryLowQuality / finalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `Unscored: ${unscored} (${((unscored / finalCount) * 100).toFixed(1)}%)`
      );

      // Calculate overall confidence
      const legitimate = highQuality + mediumQuality + lowQuality;
      console.log(`\n🎯 Overall Quality Assessment:`);
      console.log(
        `Legitimate electronics recyclers: ${legitimate} (${(
          (legitimate / finalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `High confidence entries: ${highQuality + mediumQuality} (${(
          ((highQuality + mediumQuality) / finalCount) *
          100
        ).toFixed(1)}%)`
      );
    }

    console.log(`\n✅ Comprehensive cleanup completed successfully!`);
    console.log(`📄 Backup saved to: ${backupFilename}`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
comprehensiveCleanup();
