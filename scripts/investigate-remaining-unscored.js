import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateRemainingUnscored() {
  console.log('🔍 Investigating remaining unscored entries...\n');

  try {
    // Get all remaining unscored entries
    const { data: unscored, error } = await supabase
      .from('recycling_centers')
      .select('id, name, site, city, state, phone')
      .is('legitimacy_score', null);

    if (error) throw error;

    console.log(`📊 Total remaining unscored: ${unscored.length}\n`);

    // Categorize by website availability
    const noWebsite = unscored.filter(
      (entry) => !entry.site || entry.site.trim() === ''
    );
    const hasWebsite = unscored.filter(
      (entry) => entry.site && entry.site.trim() !== ''
    );

    console.log(`📈 Breakdown:`);
    console.log(
      `  No website: ${noWebsite.length} (${(
        (noWebsite.length / unscored.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `  Has website: ${hasWebsite.length} (${(
        (hasWebsite.length / unscored.length) *
        100
      ).toFixed(1)}%)`
    );

    // Analyze entries with websites (should have been processed)
    if (hasWebsite.length > 0) {
      console.log(
        `\n❓ Entries with websites that weren't processed (${hasWebsite.length}):`
      );
      hasWebsite.slice(0, 10).forEach((entry) => {
        console.log(`  • ${entry.name} (${entry.city}, ${entry.state})`);
        console.log(`    Website: ${entry.site}`);
      });
      if (hasWebsite.length > 10) {
        console.log(`    ... and ${hasWebsite.length - 10} more`);
      }
    }

    // Analyze entries without websites (need Google Places research)
    if (noWebsite.length > 0) {
      console.log(
        `\n📋 Entries without websites (need Google Places research) - Sample of ${Math.min(
          10,
          noWebsite.length
        )}:`
      );
      noWebsite.slice(0, 10).forEach((entry) => {
        console.log(`  • ${entry.name} (${entry.city}, ${entry.state})`);
        console.log(`    Phone: ${entry.phone || 'No phone'}`);
      });
      if (noWebsite.length > 10) {
        console.log(`    ... and ${noWebsite.length - 10} more`);
      }
    }

    // Business name patterns for entries without websites
    console.log(`\n🏷️ Business name patterns (no website entries):`);
    const patterns = {
      hardware: noWebsite.filter((e) =>
        e.name.toLowerCase().includes('hardware')
      ).length,
      ace: noWebsite.filter((e) => e.name.toLowerCase().includes('ace')).length,
      'true value': noWebsite.filter((e) =>
        e.name.toLowerCase().includes('true value')
      ).length,
      recycling: noWebsite.filter((e) =>
        e.name.toLowerCase().includes('recycl')
      ).length,
      electronic: noWebsite.filter((e) =>
        e.name.toLowerCase().includes('electronic')
      ).length,
      repair: noWebsite.filter((e) => e.name.toLowerCase().includes('repair'))
        .length,
      computer: noWebsite.filter((e) =>
        e.name.toLowerCase().includes('computer')
      ).length,
      scrap: noWebsite.filter((e) => e.name.toLowerCase().includes('scrap'))
        .length,
      waste: noWebsite.filter((e) => e.name.toLowerCase().includes('waste'))
        .length,
      appliance: noWebsite.filter((e) =>
        e.name.toLowerCase().includes('appliance')
      ).length,
    };

    Object.entries(patterns)
      .filter(([key, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .forEach(([pattern, count]) => {
        console.log(`  ${pattern}: ${count} entries`);
      });

    console.log(`\n💡 Recommendations:`);
    if (hasWebsite.length > 0) {
      console.log(
        `  1. Investigate why ${hasWebsite.length} entries with websites weren't processed`
      );
    }
    console.log(
      `  2. Use Google Places API to research ${noWebsite.length} entries without websites`
    );
    console.log(
      `  3. Focus on entries with recycling/electronic/computer keywords first`
    );
  } catch (error) {
    console.error('❌ Error investigating unscored entries:', error);
    process.exit(1);
  }
}

investigateRemainingUnscored();
