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

async function analyzeUnscoredEntries() {
  console.log('🔍 Analyzing Unscored Entries\n');

  try {
    // Get total unscored count
    const { count: totalUnscored, error: countError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null);

    if (countError) throw countError;

    console.log(`📊 Total unscored entries: ${totalUnscored}\n`);

    // Analysis categories
    const categories = {
      'Municipal/Government': [
        '%municipal%',
        '%city of%',
        '%county%',
        '%government%',
        '%public works%',
        '%city %',
        '%town %',
      ],
      'Hardware Stores': [
        '%hardware%',
        '%home depot%',
        '%lowes%',
        '%menards%',
        '%ace hardware%',
      ],
      'Electronic Stores': [
        '%best buy%',
        '%radio shack%',
        '%electronics%',
        '%computer%',
        '%tech%',
      ],
      'Waste Management': [
        '%waste%',
        '%disposal%',
        '%landfill%',
        '%transfer station%',
        '%recycling center%',
        '%solid waste%',
      ],
      'Auto Related': [
        '%auto%',
        '%automotive%',
        '%car%',
        '%vehicle%',
        '%tire%',
      ],
      'Thrift/Donation': [
        '%goodwill%',
        '%salvation army%',
        '%thrift%',
        '%donation%',
        '%charity%',
      ],
      Retailers: [
        '%walmart%',
        '%target%',
        '%costco%',
        '%sams club%',
        '%kroger%',
      ],
      'Office Supply': [
        '%staples%',
        '%office depot%',
        '%fedex%',
        '%ups store%',
      ],
      'Missing Website': [], // We'll handle this separately
      'Missing Phone': [], // We'll handle this separately
      'Suspicious Names': [
        '%inc%',
        '%llc%',
        '%corp%',
        '%company%',
        '%enterprises%',
      ],
    };

    let results = {};
    let totalCategorized = 0;

    // Check each category
    for (const [categoryName, patterns] of Object.entries(categories)) {
      if (patterns.length === 0) continue; // Skip special categories for now

      console.log(`Checking ${categoryName}...`);

      let categoryCount = 0;
      let categoryEntries = [];

      // Sample some entries for each pattern
      for (const pattern of patterns) {
        const { data, error } = await supabase
          .from('recycling_centers')
          .select('id, name, city, state, phone, site, full_address')
          .is('legitimacy_score', null)
          .ilike('name', pattern)
          .limit(20); // Sample for analysis

        if (error) throw error;

        if (data && data.length > 0) {
          categoryEntries.push(...data);
        }
      }

      // Get total count for this category
      if (categoryEntries.length > 0) {
        // Remove duplicates
        const uniqueEntries = categoryEntries.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.id === item.id)
        );

        // Get exact count for the category
        let exactCount = 0;
        for (const pattern of patterns) {
          const { count, error } = await supabase
            .from('recycling_centers')
            .select('*', { count: 'exact', head: true })
            .is('legitimacy_score', null)
            .ilike('name', pattern);

          if (!error) exactCount += count;
        }

        results[categoryName] = {
          count: exactCount,
          percentage: ((exactCount / totalUnscored) * 100).toFixed(1),
          samples: uniqueEntries.slice(0, 5), // Keep first 5 for review
        };

        totalCategorized += exactCount;
        console.log(
          `  Found ${exactCount} ${categoryName} (${results[categoryName].percentage}%)`
        );
      } else {
        results[categoryName] = { count: 0, percentage: '0.0', samples: [] };
      }
    }

    // Check missing contact info
    console.log('\nChecking missing contact information...');

    const { count: missingWebsite, error: websiteError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null)
      .or('site.is.null,site.eq.');

    const { count: missingPhone, error: phoneError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null)
      .or('phone.is.null,phone.eq.');

    const { count: missingBoth, error: bothError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null)
      .or('site.is.null,site.eq.')
      .or('phone.is.null,phone.eq.');

    if (!websiteError) {
      results['Missing Website'] = {
        count: missingWebsite,
        percentage: ((missingWebsite / totalUnscored) * 100).toFixed(1),
      };
      console.log(
        `  Missing website: ${missingWebsite} (${results['Missing Website'].percentage}%)`
      );
    }

    if (!phoneError) {
      results['Missing Phone'] = {
        count: missingPhone,
        percentage: ((missingPhone / totalUnscored) * 100).toFixed(1),
      };
      console.log(
        `  Missing phone: ${missingPhone} (${results['Missing Phone'].percentage}%)`
      );
    }

    if (!bothError) {
      results['Missing Both Phone & Website'] = {
        count: missingBoth,
        percentage: ((missingBoth / totalUnscored) * 100).toFixed(1),
      };
      console.log(
        `  Missing both: ${missingBoth} (${results['Missing Both Phone & Website'].percentage}%)`
      );
    }

    // Sample some random unscored entries for general analysis
    console.log('\nGetting random sample for general analysis...');
    const { data: randomSample, error: randomError } = await supabase
      .from('recycling_centers')
      .select('id, name, city, state, phone, site, full_address')
      .is('legitimacy_score', null)
      .limit(50);

    if (randomError) throw randomError;

    const uncategorized = totalUnscored - totalCategorized;

    console.log(`\n📋 Analysis Summary:`);
    console.log(`Total unscored: ${totalUnscored}`);
    console.log(
      `Categorized: ${totalCategorized} (${(
        (totalCategorized / totalUnscored) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Uncategorized: ${uncategorized} (${(
        (uncategorized / totalUnscored) *
        100
      ).toFixed(1)}%)`
    );

    console.log(`\n🎯 Top Categories:`);
    const sortedResults = Object.entries(results)
      .filter(([_, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    sortedResults.forEach(([category, data]) => {
      console.log(`  ${category}: ${data.count} (${data.percentage}%)`);
    });

    // Save detailed results
    const timestamp = new Date().toISOString().split('T')[0];
    const analysisResults = {
      timestamp: new Date().toISOString(),
      totalUnscored,
      totalCategorized,
      uncategorized,
      categories: results,
      randomSample: randomSample.slice(0, 20), // Save 20 random samples
      recommendations: generateRecommendations(results, totalUnscored),
    };

    const filename = `unscored-analysis-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(analysisResults, null, 2));

    console.log(`\n💾 Analysis saved to: ${filename}`);
    console.log('\n' + analysisResults.recommendations);
  } catch (error) {
    console.error('❌ Error analyzing unscored entries:', error);
    process.exit(1);
  }
}

function generateRecommendations(results, totalUnscored) {
  let recommendations = '🎯 RECOMMENDATIONS FOR UNSCORED ENTRIES:\n\n';

  // Calculate removal candidates
  let safeToRemove = 0;
  let reviewNeeded = 0;
  let likelyLegitimate = 0;

  const problematic = ['Retailers', 'Auto Related'];
  const needsReview = [
    'Hardware Stores',
    'Office Supply',
    'Missing Both Phone & Website',
  ];
  const possiblyLegitimate = [
    'Municipal/Government',
    'Electronic Stores',
    'Waste Management',
    'Thrift/Donation',
  ];

  problematic.forEach((cat) => {
    if (results[cat]) safeToRemove += results[cat].count;
  });

  needsReview.forEach((cat) => {
    if (results[cat]) reviewNeeded += results[cat].count;
  });

  possiblyLegitimate.forEach((cat) => {
    if (results[cat]) likelyLegitimate += results[cat].count;
  });

  recommendations += `TIER 1 - SAFE TO REMOVE (${safeToRemove} entries, ${(
    (safeToRemove / totalUnscored) *
    100
  ).toFixed(1)}%):\n`;
  problematic.forEach((cat) => {
    if (results[cat] && results[cat].count > 0) {
      recommendations += `  • ${cat}: ${results[cat].count} entries - Clearly not electronics recycling\n`;
    }
  });

  recommendations += `\nTIER 2 - NEEDS REVIEW (${reviewNeeded} entries, ${(
    (reviewNeeded / totalUnscored) *
    100
  ).toFixed(1)}%):\n`;
  needsReview.forEach((cat) => {
    if (results[cat] && results[cat].count > 0) {
      recommendations += `  • ${cat}: ${results[cat].count} entries - Some may be legitimate, needs manual review\n`;
    }
  });

  recommendations += `\nTIER 3 - LIKELY LEGITIMATE (${likelyLegitimate} entries, ${(
    (likelyLegitimate / totalUnscored) *
    100
  ).toFixed(1)}%):\n`;
  possiblyLegitimate.forEach((cat) => {
    if (results[cat] && results[cat].count > 0) {
      recommendations += `  • ${cat}: ${results[cat].count} entries - Probably legitimate but unverified\n`;
    }
  });

  const remaining =
    totalUnscored - safeToRemove - reviewNeeded - likelyLegitimate;
  recommendations += `\nUNCATEGORIZED: ${remaining} entries (${(
    (remaining / totalUnscored) *
    100
  ).toFixed(1)}%) - Needs further analysis\n`;

  recommendations += `\n📈 PROPOSED ACTIONS:\n`;
  recommendations += `1. Remove Tier 1 (${safeToRemove} entries) - Safe cleanup\n`;
  recommendations += `2. Score Tier 3 (${likelyLegitimate} entries) - Run legitimacy scoring\n`;
  recommendations += `3. Manual review Tier 2 (${reviewNeeded} entries) - Sample and decide\n`;
  recommendations += `4. Analyze uncategorized (${remaining} entries) - Further investigation needed\n`;

  return recommendations;
}

analyzeUnscoredEntries();
