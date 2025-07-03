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

async function debugFinalStats() {
  console.log('🔍 Debug: Checking actual database statistics\n');

  try {
    // Get small sample of data to understand structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('recycling_centers')
      .select('id, name, legitimacy_score, is_legitimate, is_suspicious')
      .limit(10);

    if (sampleError) throw sampleError;

    console.log('📋 Sample data structure:');
    sampleData.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.name}`);
      console.log(
        `     Score: ${row.legitimacy_score}, Legitimate: ${row.is_legitimate}, Suspicious: ${row.is_suspicious}`
      );
    });

    // Get score distribution
    const { data: allScores, error: scoreError } = await supabase
      .from('recycling_centers')
      .select('legitimacy_score, is_legitimate')
      .not('legitimacy_score', 'is', null)
      .limit(1000);

    if (scoreError) throw scoreError;

    console.log(`\n📊 Score analysis (sample of ${allScores.length} entries):`);

    const scoreRanges = {
      'Very high (100+)': allScores.filter(
        (row) => row.legitimacy_score >= 100
      ),
      'High (70-99)': allScores.filter(
        (row) => row.legitimacy_score >= 70 && row.legitimacy_score < 100
      ),
      'Medium (50-69)': allScores.filter(
        (row) => row.legitimacy_score >= 50 && row.legitimacy_score < 70
      ),
      'Low (25-49)': allScores.filter(
        (row) => row.legitimacy_score >= 25 && row.legitimacy_score < 50
      ),
      'Very low (0-24)': allScores.filter(
        (row) => row.legitimacy_score >= 0 && row.legitimacy_score < 25
      ),
      Negative: allScores.filter((row) => row.legitimacy_score < 0),
    };

    Object.entries(scoreRanges).forEach(([range, entries]) => {
      console.log(`  ${range}: ${entries.length} entries`);
      if (entries.length > 0 && entries.length <= 3) {
        entries.forEach((entry) => {
          console.log(
            `    • Score ${entry.legitimacy_score}, Legitimate: ${entry.is_legitimate}`
          );
        });
      }
    });

    // Check legitimacy distribution
    const legitimateTrue = allScores.filter(
      (row) => row.is_legitimate === true
    );
    const legitimateFalse = allScores.filter(
      (row) => row.is_legitimate === false
    );
    const legitimateNull = allScores.filter(
      (row) => row.is_legitimate === null
    );

    console.log(`\n🎯 Legitimacy distribution (sample):`);
    console.log(`  is_legitimate = true: ${legitimateTrue.length}`);
    console.log(`  is_legitimate = false: ${legitimateFalse.length}`);
    console.log(`  is_legitimate = null: ${legitimateNull.length}`);

    // Check score averages
    const avgAll =
      allScores.reduce((sum, row) => sum + row.legitimacy_score, 0) /
      allScores.length;
    const avgLegitimate =
      legitimateTrue.length > 0
        ? legitimateTrue.reduce((sum, row) => sum + row.legitimacy_score, 0) /
          legitimateTrue.length
        : 0;
    const avgIllegitimate =
      legitimateFalse.length > 0
        ? legitimateFalse.reduce((sum, row) => sum + row.legitimacy_score, 0) /
          legitimateFalse.length
        : 0;

    console.log(`\n📈 Average scores:`);
    console.log(`  All entries: ${avgAll.toFixed(1)}`);
    console.log(`  Legitimate (true): ${avgLegitimate.toFixed(1)}`);
    console.log(`  Illegitimate (false): ${avgIllegitimate.toFixed(1)}`);

    console.log(`\n🔍 Min/Max scores:`);
    console.log(
      `  Minimum: ${Math.min(...allScores.map((row) => row.legitimacy_score))}`
    );
    console.log(
      `  Maximum: ${Math.max(...allScores.map((row) => row.legitimacy_score))}`
    );
  } catch (error) {
    console.error('❌ Error in debug:', error);
    process.exit(1);
  }
}

debugFinalStats();
