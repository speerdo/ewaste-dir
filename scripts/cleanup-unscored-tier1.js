import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupUnscoredTier1() {
  console.log('🧹 Cleaning Up Unscored Tier 1 Entries (Safe to Remove)\n');

  try {
    // Categories to remove - clearly not electronics recycling
    const tier1Categories = {
      Retailers: [
        '%target%',
        '%costco%',
        '%sams club%',
        '%kroger%',
        '%walmart%',
      ],
      'Auto Related': [
        '%cash for cars%',
        '%auto%',
        '%automotive%',
        '%car%',
        '%vehicle%',
        '%tire%',
      ],
    };

    let totalToRemove = 0;
    let backupData = [];

    // First, get count and backup data for each category
    for (const [categoryName, patterns] of Object.entries(tier1Categories)) {
      console.log(`\n📋 Analyzing ${categoryName}...`);

      for (const pattern of patterns) {
        const { data, error } = await supabase
          .from('recycling_centers')
          .select('*')
          .is('legitimacy_score', null)
          .ilike('name', pattern);

        if (error) throw error;

        if (data && data.length > 0) {
          console.log(`  Found ${data.length} entries matching "${pattern}"`);
          backupData.push(...data);
          totalToRemove += data.length;
        }
      }
    }

    // Remove duplicates from backup
    const uniqueBackup = backupData.filter(
      (item, index, self) => index === self.findIndex((t) => t.id === item.id)
    );

    console.log(`\n🎯 Total entries to remove: ${uniqueBackup.length}`);

    if (uniqueBackup.length === 0) {
      console.log('✅ No entries found to remove.');
      return;
    }

    // Save backup
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFilename = `backup-unscored-tier1-${timestamp}.json`;
    fs.writeFileSync(
      backupFilename,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          reason:
            'Unscored Tier 1 cleanup - retailers and auto-related businesses',
          totalRemoved: uniqueBackup.length,
          entries: uniqueBackup,
        },
        null,
        2
      )
    );

    console.log(`💾 Backup saved to: ${backupFilename}`);

    // Show sample of what will be removed
    console.log('\n📄 Sample entries to be removed:');
    uniqueBackup.slice(0, 10).forEach((entry) => {
      console.log(`  • ${entry.name} - ${entry.city}, ${entry.state}`);
    });

    // Ask for confirmation
    console.log(`\n⚠️  About to remove ${uniqueBackup.length} entries.`);
    console.log('These are clearly not electronics recycling centers.');

    // In production, you might want to add a confirmation prompt
    // For now, proceeding with removal

    let removedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < uniqueBackup.length; i += batchSize) {
      const batch = uniqueBackup.slice(i, i + batchSize);
      const idsToRemove = batch.map((entry) => entry.id);

      const { error } = await supabase
        .from('recycling_centers')
        .delete()
        .in('id', idsToRemove);

      if (error) {
        console.error(`❌ Error removing batch ${i / batchSize + 1}:`, error);
        break;
      }

      removedCount += batch.length;
      console.log(
        `✅ Removed batch ${Math.floor(i / batchSize) + 1}: ${
          batch.length
        } entries (${removedCount}/${uniqueBackup.length})`
      );
    }

    console.log(`\n🎉 Successfully removed ${removedCount} Tier 1 entries!`);

    // Show updated stats
    const { count: newTotal, error: countError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true });

    const { count: newUnscored, error: unscoredError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null);

    if (!countError && !unscoredError) {
      console.log(`\n📊 Updated Statistics:`);
      console.log(`Total Centers: ${newTotal}`);
      console.log(`Unscored Centers: ${newUnscored}`);
      console.log(`Removed: ${removedCount} entries`);
    }

    console.log(
      `\n✅ Tier 1 cleanup complete! Backup saved to: ${backupFilename}`
    );
  } catch (error) {
    console.error('❌ Error during Tier 1 cleanup:', error);
    process.exit(1);
  }
}

cleanupUnscoredTier1();
