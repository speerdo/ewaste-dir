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

async function analyzeUnscoredReasons() {
  console.log(
    '🔍 Analyzing why entries are unscored and what needs proper scraping...\n'
  );

  try {
    // Get total unscored count
    const { count: totalUnscored, error: countError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null);

    if (countError) throw countError;
    console.log(`📊 Total unscored entries: ${totalUnscored}\n`);

    // Get sample of unscored entries
    const { data: unscoredSample, error: sampleError } = await supabase
      .from('recycling_centers')
      .select(
        'id, name, site, city, state, scraped_at, legitimacy_reason, legitimacy_score'
      )
      .is('legitimacy_score', null)
      .limit(500);

    if (sampleError) throw sampleError;

    // Analyze the patterns
    let analysis = {
      total: unscoredSample.length,
      hasWebsite: 0,
      noWebsite: 0,
      wasScraped: 0,
      neverScraped: 0,
      myPhase3bScoring: 0,
      needsWebsiteScraping: 0,
      needsGooglePlaces: 0,
    };

    const needsWebsiteScraping = [];
    const needsGooglePlaces = [];
    const mysterious = [];

    unscoredSample.forEach((entry) => {
      // Basic counts
      if (entry.site && entry.site.trim() !== '') {
        analysis.hasWebsite++;

        // If has website but no score, needs website scraping
        if (!entry.scraped_at) {
          analysis.needsWebsiteScraping++;
          needsWebsiteScraping.push(entry);
        } else {
          // Was scraped but no score - mysterious
          mysterious.push(entry);
        }
      } else {
        analysis.noWebsite++;
        analysis.needsGooglePlaces++;
        needsGooglePlaces.push(entry);
      }

      if (entry.scraped_at) {
        analysis.wasScraped++;
      } else {
        analysis.neverScraped++;
      }

      if (
        entry.legitimacy_reason &&
        entry.legitimacy_reason.includes('Pattern-based scoring')
      ) {
        analysis.myPhase3bScoring++;
      }
    });

    // Print analysis
    console.log(`📊 ANALYSIS OF ${analysis.total} UNSCORED ENTRIES:`);
    console.log(
      `  Has website: ${analysis.hasWebsite} (${(
        (analysis.hasWebsite / analysis.total) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `  No website: ${analysis.noWebsite} (${(
        (analysis.noWebsite / analysis.total) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `  Was scraped before: ${analysis.wasScraped} (${(
        (analysis.wasScraped / analysis.total) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `  Never scraped: ${analysis.neverScraped} (${(
        (analysis.neverScraped / analysis.total) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `  My incorrect Phase 3B scoring: ${analysis.myPhase3bScoring}`
    );

    console.log(`\n🎯 WHAT NEEDS PROPER SCORING:`);
    console.log(
      `  ✅ Needs website scraping: ${needsWebsiteScraping.length} entries (have website, never scraped)`
    );
    console.log(
      `  🔍 Needs Google Places research: ${needsGooglePlaces.length} entries (no website)`
    );
    console.log(
      `  ❓ Mysterious (scraped but no score): ${mysterious.length} entries`
    );

    console.log(
      `\n📋 SAMPLES - NEEDS WEBSITE SCRAPING (${Math.min(
        10,
        needsWebsiteScraping.length
      )} of ${needsWebsiteScraping.length}):`
    );
    needsWebsiteScraping.slice(0, 10).forEach((entry) => {
      console.log(`  • ${entry.name} (${entry.city}, ${entry.state})`);
      console.log(`    Website: ${entry.site}`);
      console.log(`    Scraped: ${entry.scraped_at || 'NEVER'}`);
    });

    console.log(
      `\n📋 SAMPLES - NEEDS GOOGLE PLACES (${Math.min(
        5,
        needsGooglePlaces.length
      )} of ${needsGooglePlaces.length}):`
    );
    needsGooglePlaces.slice(0, 5).forEach((entry) => {
      console.log(`  • ${entry.name} (${entry.city}, ${entry.state})`);
      console.log(`    Website: NONE`);
    });

    if (mysterious.length > 0) {
      console.log(
        `\n📋 SAMPLES - MYSTERIOUS (${Math.min(5, mysterious.length)} of ${
          mysterious.length
        }):`
      );
      mysterious.slice(0, 5).forEach((entry) => {
        console.log(`  • ${entry.name} (${entry.city}, ${entry.state})`);
        console.log(`    Website: ${entry.site}`);
        console.log(`    Scraped: ${entry.scraped_at}`);
        console.log(`    Reason: ${entry.legitimacy_reason || 'NONE'}`);
      });
    }

    // Estimate total counts based on sample
    const scaleFactor = totalUnscored / analysis.total;
    console.log(`\n🎯 ESTIMATED TOTALS (scaled from sample):`);
    console.log(
      `  📄 Websites to scrape: ~${Math.round(
        needsWebsiteScraping.length * scaleFactor
      )} entries`
    );
    console.log(
      `  🔍 Google Places research: ~${Math.round(
        needsGooglePlaces.length * scaleFactor
      )} entries`
    );
    console.log(
      `  ❓ Mysterious entries: ~${Math.round(
        mysterious.length * scaleFactor
      )} entries`
    );

    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    console.log(
      `  1. Start with website scraping (~${Math.round(
        needsWebsiteScraping.length * scaleFactor
      )} entries)`
    );
    console.log(
      `  2. Follow with Google Places research for entries without websites`
    );
    console.log(
      `  3. Investigate mysterious entries (were scraped but no score)`
    );

    return {
      analysis,
      needsWebsiteScraping: needsWebsiteScraping.length * scaleFactor,
      needsGooglePlaces: needsGooglePlaces.length * scaleFactor,
      mysterious: mysterious.length * scaleFactor,
    };
  } catch (error) {
    console.error('❌ Error analyzing unscored reasons:', error);
    process.exit(1);
  }
}

analyzeUnscoredReasons();
