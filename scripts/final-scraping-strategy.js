import fs from 'fs/promises';
import csv from 'csv-parser';
import { createReadStream } from 'fs';

const CONFIG = {
  MANUAL_REVIEW_FILE: './data/places_research/manual_review_centers.csv',
  OUTPUT_DIR: './data/final_scraping',
  MINIMUM_LEGITIMACY_SCORE: 10, // Focus on legitimate businesses
  MINIMUM_CONFIDENCE: 75, // Focus on high-confidence matches
  MAX_CENTERS_TO_SCRAPE: 1000, // Reasonable batch size

  // Alternative data sources to try
  SEARCH_SOURCES: [
    'yelp',
    'yellowpages',
    'google_business',
    'bbb', // Better Business Bureau
    'foursquare',
    'facebook',
  ],

  // Priority scoring weights
  PRIORITY_WEIGHTS: {
    legitimacy_score: 0.4,
    confidence: 0.3,
    has_phone: 0.2,
    has_rating: 0.1,
  },
};

async function loadManualReviewCenters() {
  const centers = [];

  return new Promise((resolve, reject) => {
    createReadStream(CONFIG.MANUAL_REVIEW_FILE)
      .pipe(csv())
      .on('data', (row) => {
        // Parse numeric fields
        const center = {
          id: row['Center ID'],
          name: row['Name'],
          city: row['City'],
          state: row['State'],
          centerType: row['Center Type'],
          websiteFound: row['Website Found'],
          existingWebsite: row['Existing Website'],
          confidence: parseInt(row['Confidence']) || 0,
          legitimacyScore: parseInt(row['Legitimacy Score']) || 0,
          phone: row['Phone'],
          rating: parseFloat(row['Rating']) || null,
          reviewCount: parseInt(row['Review Count']) || 0,
          ewasteKeywords: row['E-waste Keywords'],
          redFlagKeywords: row['Red Flag Keywords'],
          reason: row['Reason'],
        };

        centers.push(center);
      })
      .on('end', () => resolve(centers))
      .on('error', reject);
  });
}

function calculatePriorityScore(center) {
  let score = 0;

  // Legitimacy score (0-40 points)
  score +=
    Math.max(0, Math.min(40, center.legitimacyScore)) *
    CONFIG.PRIORITY_WEIGHTS.legitimacy_score;

  // Confidence (0-30 points)
  score += (center.confidence / 100) * 30 * CONFIG.PRIORITY_WEIGHTS.confidence;

  // Has phone (0-20 points)
  score +=
    (center.phone && center.phone.trim() ? 20 : 0) *
    CONFIG.PRIORITY_WEIGHTS.has_phone;

  // Has rating (0-10 points)
  score += (center.rating ? 10 : 0) * CONFIG.PRIORITY_WEIGHTS.has_rating;

  return score;
}

function categorizeCenters(centers) {
  const categories = {
    highPriority: [], // Score ≥ 15, legitimacy ≥ 20
    mediumPriority: [], // Score ≥ 10, legitimacy ≥ 10
    lowPriority: [], // Score ≥ 5, legitimacy ≥ 0
    skipList: [], // Everything else
  };

  centers.forEach((center) => {
    const priorityScore = calculatePriorityScore(center);
    center.priorityScore = priorityScore;

    if (priorityScore >= 15 && center.legitimacyScore >= 20) {
      categories.highPriority.push(center);
    } else if (priorityScore >= 10 && center.legitimacyScore >= 10) {
      categories.mediumPriority.push(center);
    } else if (priorityScore >= 5 && center.legitimacyScore >= 0) {
      categories.lowPriority.push(center);
    } else {
      categories.skipList.push(center);
    }
  });

  // Sort each category by priority score
  Object.keys(categories).forEach((cat) => {
    if (cat !== 'skipList') {
      categories[cat].sort((a, b) => b.priorityScore - a.priorityScore);
    }
  });

  return categories;
}

function createScrapingPlan(categories) {
  const plan = {
    phase1: categories.highPriority.slice(0, 300), // Top 300 high-priority
    phase2: categories.mediumPriority.slice(0, 400), // Top 400 medium-priority
    phase3: categories.lowPriority.slice(0, 300), // Top 300 low-priority
    skipped: [
      ...categories.highPriority.slice(300),
      ...categories.mediumPriority.slice(400),
      ...categories.lowPriority.slice(300),
      ...categories.skipList,
    ],
  };

  return plan;
}

async function generateSearchQueries(center) {
  const queries = [];
  const baseName = center.name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const location = `${center.city} ${center.state}`;

  // Primary business name searches
  queries.push(`"${baseName}" "${location}"`);
  queries.push(`${baseName} ${location}`);

  // Add business type context
  const businessTypes = [
    'recycling',
    'scrap metal',
    'electronics',
    'computer repair',
    'waste management',
  ];
  businessTypes.forEach((type) => {
    queries.push(`"${baseName}" ${type} "${location}"`);
  });

  // Phone number search if available
  if (center.phone) {
    queries.push(`"${center.phone}"`);
  }

  return queries;
}

async function main() {
  console.log('🎯 Starting Final Scraping Strategy Analysis...');

  try {
    // Create output directory
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });

    // Load manual review centers
    console.log('📊 Loading manual review centers...');
    const centers = await loadManualReviewCenters();
    console.log(`📋 Loaded ${centers.length} centers for analysis`);

    // Categorize centers by priority
    console.log('🔍 Categorizing centers by priority...');
    const categories = categorizeCenters(centers);

    // Create scraping plan
    console.log('📋 Creating scraping plan...');
    const plan = createScrapingPlan(categories);

    // Generate statistics
    const stats = {
      total_centers: centers.length,
      categories: {
        high_priority: categories.highPriority.length,
        medium_priority: categories.mediumPriority.length,
        low_priority: categories.lowPriority.length,
        skip_list: categories.skipList.length,
      },
      planned_scraping: {
        phase1_high: plan.phase1.length,
        phase2_medium: plan.phase2.length,
        phase3_low: plan.phase3.length,
        total_planned:
          plan.phase1.length + plan.phase2.length + plan.phase3.length,
        skipped: plan.skipped.length,
      },
      legitimacy_distribution: {
        very_high: centers.filter((c) => c.legitimacyScore >= 50).length,
        high: centers.filter(
          (c) => c.legitimacyScore >= 20 && c.legitimacyScore < 50
        ).length,
        medium: centers.filter(
          (c) => c.legitimacyScore >= 10 && c.legitimacyScore < 20
        ).length,
        low: centers.filter(
          (c) => c.legitimacyScore >= 0 && c.legitimacyScore < 10
        ).length,
        negative: centers.filter((c) => c.legitimacyScore < 0).length,
      },
    };

    // Save analysis results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    await fs.writeFile(
      `${CONFIG.OUTPUT_DIR}/scraping_strategy_${timestamp}.json`,
      JSON.stringify(
        {
          strategy: plan,
          statistics: stats,
          config: CONFIG,
          generated_at: new Date().toISOString(),
        },
        null,
        2
      )
    );

    // Save targetable centers CSV for each phase
    for (const [phase, centers] of Object.entries(plan)) {
      if (phase !== 'skipped' && centers.length > 0) {
        const csvContent = [
          'Center ID,Name,City,State,Phone,Priority Score,Legitimacy Score,Confidence,Existing Website,Search Queries',
          ...(await Promise.all(
            centers.map(async (center) => {
              const queries = await generateSearchQueries(center);
              return [
                center.id,
                `"${center.name}"`,
                center.city,
                center.state,
                center.phone || '',
                center.priorityScore.toFixed(2),
                center.legitimacyScore,
                center.confidence,
                center.existingWebsite || '',
                `"${queries.join('; ')}"`,
              ].join(',');
            })
          )),
        ].join('\n');

        await fs.writeFile(
          `${CONFIG.OUTPUT_DIR}/${phase}_targets_${timestamp}.csv`,
          csvContent
        );
      }
    }

    // Print summary
    console.log('\n📊 FINAL SCRAPING STRATEGY SUMMARY');
    console.log('=====================================');
    console.log(
      `📋 Total Centers Analyzed: ${stats.total_centers.toLocaleString()}`
    );
    console.log(
      `\n🎯 RECOMMENDED FOR FINAL SCRAPING: ${stats.planned_scraping.total_planned.toLocaleString()} centers`
    );
    console.log(
      `   • Phase 1 (High Priority): ${stats.planned_scraping.phase1_high.toLocaleString()} centers`
    );
    console.log(
      `   • Phase 2 (Medium Priority): ${stats.planned_scraping.phase2_medium.toLocaleString()} centers`
    );
    console.log(
      `   • Phase 3 (Low Priority): ${stats.planned_scraping.phase3_low.toLocaleString()} centers`
    );
    console.log(
      `\n❌ RECOMMEND REMOVING: ${stats.planned_scraping.skipped.toLocaleString()} centers`
    );

    console.log(`\n📈 LEGITIMACY SCORE DISTRIBUTION:`);
    console.log(
      `   • Very High (50+): ${stats.legitimacy_distribution.very_high.toLocaleString()}`
    );
    console.log(
      `   • High (20-49): ${stats.legitimacy_distribution.high.toLocaleString()}`
    );
    console.log(
      `   • Medium (10-19): ${stats.legitimacy_distribution.medium.toLocaleString()}`
    );
    console.log(
      `   • Low (0-9): ${stats.legitimacy_distribution.low.toLocaleString()}`
    );
    console.log(
      `   • Negative (<0): ${stats.legitimacy_distribution.negative.toLocaleString()}`
    );

    const removalPercentage = (
      (stats.planned_scraping.skipped / stats.total_centers) *
      100
    ).toFixed(1);
    const keepPercentage = (
      (stats.planned_scraping.total_planned / stats.total_centers) *
      100
    ).toFixed(1);

    console.log(`\n💡 RECOMMENDATION:`);
    console.log(
      `   • KEEP: ${keepPercentage}% of centers (${stats.planned_scraping.total_planned.toLocaleString()}) for final scraping`
    );
    console.log(
      `   • REMOVE: ${removalPercentage}% of centers (${stats.planned_scraping.skipped.toLocaleString()}) from database`
    );

    console.log(`\n📁 Strategy files saved to: ${CONFIG.OUTPUT_DIR}/`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
