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

async function phase3BScorePromisingEntries() {
  console.log('🎯 Phase 3B: Pattern Scoring Promising Unscored Entries\n');

  try {
    // Get initial unscored count
    const { count: initialUnscored, error: countError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null);

    if (countError) throw countError;
    console.log(`📊 Starting with ${initialUnscored} unscored entries\n`);

    let allScoredEntries = [];
    let totalScored = 0;

    // Define promising categories to score
    const promisingCategories = {
      'Scrap Metal': {
        patterns: [
          'scrap',
          'metal',
          'steel',
          'aluminum',
          'copper',
          'iron',
          'junk',
        ],
        baseScore: 40, // Conservative base score
        bonusPatterns: {
          electronics: 15,
          electronic: 15,
          'e-waste': 20,
          ewaste: 20,
          computer: 10,
          recycle: 25,
          recycling: 25,
        },
        description: 'Scrap metal businesses (some handle electronics)',
      },
      'Generic Business Names': {
        patterns: [
          'llc',
          'inc',
          'corp',
          'company',
          'enterprises',
          'solutions',
          'services',
        ],
        baseScore: 30, // More conservative since generic
        bonusPatterns: {
          recycle: 30,
          recycling: 30,
          'e-waste': 25,
          ewaste: 25,
          electronic: 20,
          electronics: 20,
          computer: 15,
          tech: 15,
          technology: 15,
          waste: 10,
          disposal: 10,
          environment: 10,
          green: 10,
        },
        description: 'Generic business names (could be legitimate recyclers)',
      },
    };

    // Process each category
    for (const [categoryName, config] of Object.entries(promisingCategories)) {
      console.log(`🔍 Processing: ${categoryName}`);

      let entriesToScore = [];

      // Find entries matching patterns
      for (const pattern of config.patterns) {
        const { data: matches, error: matchError } = await supabase
          .from('recycling_centers')
          .select('*')
          .is('legitimacy_score', null)
          .ilike('name', `%${pattern}%`);

        if (matchError) throw matchError;
        if (matches && matches.length > 0) {
          entriesToScore.push(...matches);
        }
      }

      // Remove duplicates
      const uniqueEntries = entriesToScore.filter(
        (item, index, self) => index === self.findIndex((t) => t.id === item.id)
      );

      if (uniqueEntries.length > 0) {
        console.log(`  📋 Found ${uniqueEntries.length} entries to score`);

        let scoredInCategory = 0;
        const categoryResults = [];

        // Score each entry
        for (const entry of uniqueEntries) {
          const score = calculatePatternScore(entry, config);

          if (score >= 25) {
            // Minimum legitimacy threshold
            // Update the entry with score
            const { error: updateError } = await supabase
              .from('recycling_centers')
              .update({
                legitimacy_score: score,
                legitimacy_reason: `Pattern-based scoring (${categoryName})`,
                is_legitimate: true,
                is_suspicious: false,
              })
              .eq('id', entry.id);

            if (updateError) {
              console.error(
                `  ❌ Error scoring entry ${entry.id}: ${updateError.message}`
              );
              continue;
            }

            categoryResults.push({
              id: entry.id,
              name: entry.name,
              city: entry.city,
              state: entry.state,
              score: score,
              reason: `Pattern-based scoring (${categoryName})`,
            });

            scoredInCategory++;
          }
        }

        if (scoredInCategory > 0) {
          allScoredEntries.push({
            category: categoryName,
            description: config.description,
            totalFound: uniqueEntries.length,
            scored: scoredInCategory,
            averageScore:
              categoryResults.length > 0
                ? Math.round(
                    categoryResults.reduce(
                      (sum, entry) => sum + entry.score,
                      0
                    ) / categoryResults.length
                  )
                : 0,
            entries: categoryResults,
          });

          totalScored += scoredInCategory;
          console.log(
            `  ✅ ${categoryName}: Scored ${scoredInCategory}/${
              uniqueEntries.length
            } entries (avg score: ${
              allScoredEntries[allScoredEntries.length - 1].averageScore
            })\n`
          );
        } else {
          console.log(
            `  ⚠️  ${categoryName}: Found ${uniqueEntries.length} entries but none met minimum score threshold\n`
          );
        }
      } else {
        console.log(`  ✅ ${categoryName}: No entries found\n`);
      }
    }

    // Get final counts
    const { count: finalUnscored, error: finalUnscoredError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .is('legitimacy_score', null);

    if (finalUnscoredError) throw finalUnscoredError;

    const { count: totalEntries, error: totalError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Save results
    const timestamp = new Date().toISOString().split('T')[0];
    const resultsData = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 3B - Pattern Scoring Promising Entries',
      initialUnscored,
      finalUnscored,
      totalScored,
      categoriesProcessed: allScoredEntries.length,
      scoredByCategory: allScoredEntries,
    };

    const resultsFilename = `data/database-audit-${timestamp}/phase3b-scoring-results-${timestamp}.json`;
    fs.writeFileSync(resultsFilename, JSON.stringify(resultsData, null, 2));

    // Print summary
    console.log('='.repeat(70));
    console.log('🎉 PHASE 3B PATTERN SCORING COMPLETE');
    console.log('='.repeat(70));
    console.log(`📊 Unscored entries: ${initialUnscored} → ${finalUnscored}`);
    console.log(`🎯 Successfully scored: ${totalScored} entries`);
    console.log(
      `📊 Database now ${(
        ((totalEntries - finalUnscored) / totalEntries) *
        100
      ).toFixed(1)}% scored`
    );
    console.log(`📁 Results saved to: ${resultsFilename}`);

    console.log('\n📋 SCORING SUMMARY:');
    allScoredEntries.forEach((category) => {
      console.log(
        `  • ${category.category}: ${category.scored}/${category.totalFound} scored (avg: ${category.averageScore})`
      );
    });

    console.log(`\n🎯 IMPACT:`);
    console.log(
      `  Unscored entries reduced from ${initialUnscored} to ${finalUnscored}`
    );
    console.log(`  Total legitimate entries increased by ${totalScored}`);

    console.log('\n✅ Ready for Phase 3C: Manual review sampling');
  } catch (error) {
    console.error('❌ Error during Phase 3B scoring:', error);
    process.exit(1);
  }
}

function calculatePatternScore(entry, config) {
  let score = config.baseScore;
  const name = entry.name.toLowerCase();

  // Check for bonus patterns in name
  for (const [pattern, bonus] of Object.entries(config.bonusPatterns)) {
    if (name.includes(pattern.toLowerCase())) {
      score += bonus;
    }
  }

  // Contact info bonuses
  if (entry.phone && entry.phone.trim() !== '') {
    score += 5; // Has phone
  }

  if (entry.site && entry.site.trim() !== '') {
    score += 10; // Has website
  }

  // Address quality bonus
  if (entry.full_address && entry.full_address.length > 20) {
    score += 5; // Detailed address
  }

  return Math.min(score, 100); // Cap at 100
}

phase3BScorePromisingEntries();
