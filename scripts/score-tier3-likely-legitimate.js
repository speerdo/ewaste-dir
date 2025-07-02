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

async function scoreTier3LikelyLegitimate() {
  console.log('🎯 Scoring Tier 3 "Likely Legitimate" Unscored Entries\n');

  try {
    // Define the categories we're confident are legitimate
    const tier3Categories = {
      'Electronic Stores': {
        patterns: [
          '%best buy%',
          '%radio shack%',
          '%electronics%',
          '%computer%',
          '%tech%',
        ],
        baseScore: 70,
        reason: 'Electronics store - likely accepts electronics recycling',
      },
      'Thrift/Donation': {
        patterns: [
          '%goodwill%',
          '%salvation army%',
          '%thrift%',
          '%donation%',
          '%charity%',
        ],
        baseScore: 55,
        reason: 'Thrift/donation store - many accept electronics donations',
      },
      'Waste Management': {
        patterns: [
          '%waste%',
          '%disposal%',
          '%landfill%',
          '%transfer station%',
          '%recycling center%',
          '%solid waste%',
        ],
        baseScore: 65,
        reason:
          'Waste management facility - likely handles electronics recycling',
      },
      'Municipal/Government': {
        patterns: [
          '%municipal%',
          '%city of%',
          '%county%',
          '%government%',
          '%public works%',
          '%city %',
          '%town %',
        ],
        baseScore: 60,
        reason:
          'Municipal/government facility - likely has electronics recycling program',
      },
    };

    let totalScored = 0;
    let scoringResults = [];

    // Process each category
    for (const [categoryName, config] of Object.entries(tier3Categories)) {
      console.log(`\n📋 Processing ${categoryName}...`);

      let categoryEntries = [];

      // Get all entries for this category
      for (const pattern of config.patterns) {
        const { data, error } = await supabase
          .from('recycling_centers')
          .select('id, name, city, state, phone, site, full_address')
          .is('legitimacy_score', null)
          .ilike('name', pattern);

        if (error) throw error;

        if (data && data.length > 0) {
          categoryEntries.push(...data);
        }
      }

      // Remove duplicates
      const uniqueEntries = categoryEntries.filter(
        (item, index, self) => index === self.findIndex((t) => t.id === item.id)
      );

      console.log(`  Found ${uniqueEntries.length} entries in ${categoryName}`);

      if (uniqueEntries.length === 0) continue;

      // Apply pattern-based scoring to each entry
      for (const entry of uniqueEntries) {
        const scoringData = scoreEntry(entry, categoryName, config);

        // Update the database
        const { error: updateError } = await supabase
          .from('recycling_centers')
          .update({
            legitimacy_score: scoringData.legitimacyScore,
            legitimacy_reason: scoringData.legitimacyReason,
            is_legitimate: scoringData.isLegitimate,
            is_suspicious: scoringData.isSuspicious,
            scraped_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`❌ Error updating entry ${entry.id}:`, updateError);
          continue;
        }

        scoringResults.push({
          ...entry,
          category: categoryName,
          ...scoringData,
        });

        totalScored++;
      }

      console.log(
        `  ✅ Scored ${uniqueEntries.length} ${categoryName} entries`
      );
    }

    console.log(`\n🎉 Successfully scored ${totalScored} entries!`);

    // Save scoring results for review
    const timestamp = new Date().toISOString().split('T')[0];
    const resultsFile = `tier3-scoring-results-${timestamp}.json`;

    fs.writeFileSync(
      resultsFile,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          totalScored,
          categories: Object.keys(tier3Categories),
          results: scoringResults.slice(0, 100), // Sample results for review
          summary: generateSummary(scoringResults),
        },
        null,
        2
      )
    );

    console.log(`💾 Results saved to: ${resultsFile}`);

    // Show summary statistics
    const summary = generateSummary(scoringResults);
    console.log('\n📊 Scoring Summary:');
    Object.entries(summary.byCategory).forEach(([category, stats]) => {
      console.log(
        `  ${category}: ${
          stats.count
        } entries, avg score: ${stats.avgScore.toFixed(1)}`
      );
    });

    console.log(`\n✅ Score Distribution:`);
    console.log(`  High (≥50): ${summary.highScore} entries`);
    console.log(`  Medium (35-49): ${summary.mediumScore} entries`);
    console.log(`  Low (25-34): ${summary.lowScore} entries`);
    console.log(
      `  Legitimate (≥25): ${summary.legitimate} entries (${(
        (summary.legitimate / totalScored) *
        100
      ).toFixed(1)}%)`
    );

    // Show updated database statistics
    await showUpdatedStats();
  } catch (error) {
    console.error('❌ Error scoring Tier 3 entries:', error);
    process.exit(1);
  }
}

function scoreEntry(entry, category, config) {
  let legitimacyScore = config.baseScore;
  let legitimacyReason = [config.reason];

  const nameLower = entry.name.toLowerCase();

  // Bonus scoring based on specific indicators in the name
  if (nameLower.includes('recycling') || nameLower.includes('recycle')) {
    legitimacyScore += 15;
    legitimacyReason.push('Name contains recycling keywords');
  }

  if (nameLower.includes('electronics') || nameLower.includes('electronic')) {
    legitimacyScore += 20;
    legitimacyReason.push('Name contains electronics keywords');
  }

  if (nameLower.includes('e-waste') || nameLower.includes('ewaste')) {
    legitimacyScore += 25;
    legitimacyReason.push('Name contains e-waste keywords');
  }

  // Specific high-value business patterns
  if (nameLower.includes('best buy')) {
    legitimacyScore += 25;
    legitimacyReason.push('Major electronics retailer with recycling program');
  }

  if (nameLower.includes('goodwill')) {
    legitimacyScore += 20;
    legitimacyReason.push('Goodwill - accepts electronics donations');
  }

  if (nameLower.includes('salvation army')) {
    legitimacyScore += 20;
    legitimacyReason.push('Salvation Army - accepts electronics donations');
  }

  // Municipal/government bonuses
  if (category === 'Municipal/Government') {
    if (
      nameLower.includes('transfer station') ||
      nameLower.includes('collection center')
    ) {
      legitimacyScore += 15;
      legitimacyReason.push('Government collection/transfer facility');
    }

    if (
      nameLower.includes('public works') ||
      nameLower.includes('sanitation')
    ) {
      legitimacyScore += 10;
      legitimacyReason.push('Public works/sanitation department');
    }
  }

  // Waste management bonuses
  if (category === 'Waste Management') {
    if (
      nameLower.includes('casella') ||
      nameLower.includes('republic') ||
      nameLower.includes('waste connections')
    ) {
      legitimacyScore += 15;
      legitimacyReason.push('Major waste management company');
    }
  }

  // Contact information bonus
  if (entry.phone && entry.site) {
    legitimacyScore += 10;
    legitimacyReason.push('Has both phone and website contact info');
  } else if (entry.phone || entry.site) {
    legitimacyScore += 5;
    legitimacyReason.push('Has contact information available');
  }

  // Penalties for potential red flags in names
  if (
    nameLower.includes('auto') ||
    nameLower.includes('automotive') ||
    nameLower.includes('car')
  ) {
    legitimacyScore -= 10;
    legitimacyReason.push(
      'Name suggests automotive focus - may not handle electronics'
    );
  }

  return {
    legitimacyScore,
    legitimacyReason: legitimacyReason.join('; '),
    isLegitimate: legitimacyScore >= 25,
    isSuspicious: legitimacyScore < -10,
  };
}

function generateSummary(results) {
  const summary = {
    byCategory: {},
    highScore: 0,
    mediumScore: 0,
    lowScore: 0,
    legitimate: 0,
  };

  // Count by category
  results.forEach((result) => {
    if (!summary.byCategory[result.category]) {
      summary.byCategory[result.category] = {
        count: 0,
        totalScore: 0,
        avgScore: 0,
      };
    }

    summary.byCategory[result.category].count++;
    summary.byCategory[result.category].totalScore += result.legitimacyScore;

    // Count score distributions
    if (result.legitimacyScore >= 50) summary.highScore++;
    else if (result.legitimacyScore >= 35) summary.mediumScore++;
    else if (result.legitimacyScore >= 25) summary.lowScore++;

    if (result.isLegitimate) summary.legitimate++;
  });

  // Calculate averages
  Object.keys(summary.byCategory).forEach((category) => {
    const cat = summary.byCategory[category];
    cat.avgScore = cat.totalScore / cat.count;
  });

  return summary;
}

async function showUpdatedStats() {
  try {
    const { count: newTotal } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true });

    const { count: newScored } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .not('legitimacy_score', 'is', null);

    const { count: newUnscored } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null);

    console.log(`\n📊 Updated Database Statistics:`);
    console.log(`Total Centers: ${newTotal}`);
    console.log(
      `Scored Centers: ${newScored} (${((newScored / newTotal) * 100).toFixed(
        1
      )}%)`
    );
    console.log(
      `Unscored Centers: ${newUnscored} (${(
        (newUnscored / newTotal) *
        100
      ).toFixed(1)}%)`
    );
  } catch (error) {
    console.error('Error getting updated stats:', error);
  }
}

scoreTier3LikelyLegitimate();
