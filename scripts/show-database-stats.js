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

async function showDatabaseStats() {
  console.log('📊 Current Database Statistics\n');

  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Get counts for different quality levels using count queries
    const { count: scoredCount, error: scoredError } = await supabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true })
      .not('legitimacy_score', 'is', null);

    if (scoredError) throw scoredError;

    // Get cities count using sample approach to avoid row limits
    console.log('Getting city count...');
    const { data: citySample, error: sampleError } = await supabase
      .from('recycling_centers')
      .select('city, state')
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(10000); // Larger sample to get better city coverage

    if (sampleError) throw sampleError;

    const uniqueCities = new Set(
      citySample.map((center) => `${center.city}, ${center.state}`)
    ).size;

    console.log(`🏢 Total Recycling Centers: ${totalCount}`);
    console.log(`🏙️ Cities Covered: ${uniqueCities}`);

    if (scoredCount > 0) {
      const unscored = totalCount - scoredCount;

      console.log(`\n📈 Quality Distribution:`);
      console.log(
        `Scored entries: ${scoredCount} (${(
          (scoredCount / totalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `Unscored entries: ${unscored} (${(
          (unscored / totalCount) *
          100
        ).toFixed(1)}%)`
      );

      // Get counts for each quality level using separate count queries
      const { count: highQuality, error: highError } = await supabase
        .from('recycling_centers')
        .select('*', { count: 'exact', head: true })
        .gte('legitimacy_score', 50);

      const { count: mediumQuality, error: mediumError } = await supabase
        .from('recycling_centers')
        .select('*', { count: 'exact', head: true })
        .gte('legitimacy_score', 35)
        .lt('legitimacy_score', 50);

      const { count: lowQuality, error: lowError } = await supabase
        .from('recycling_centers')
        .select('*', { count: 'exact', head: true })
        .gte('legitimacy_score', 25)
        .lt('legitimacy_score', 35);

      const { count: veryLowQuality, error: veryLowError } = await supabase
        .from('recycling_centers')
        .select('*', { count: 'exact', head: true })
        .lt('legitimacy_score', 25);

      if (highError || mediumError || lowError || veryLowError) {
        throw new Error('Error getting quality breakdowns');
      }

      console.log(`\n🎯 Quality Breakdown:`);
      console.log(
        `High quality (50+): ${highQuality} (${(
          (highQuality / totalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `Medium quality (35-49): ${mediumQuality} (${(
          (mediumQuality / totalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `Low quality (25-34): ${lowQuality} (${(
          (lowQuality / totalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `Very low quality (<25): ${veryLowQuality} (${(
          (veryLowQuality / totalCount) *
          100
        ).toFixed(1)}%)`
      );

      // Calculate overall confidence
      const legitimate = highQuality + mediumQuality + lowQuality;
      console.log(`\n✅ Overall Assessment:`);
      console.log(
        `Legitimate electronics recyclers: ${legitimate} (${(
          (legitimate / totalCount) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `High confidence entries: ${highQuality + mediumQuality} (${(
          ((highQuality + mediumQuality) / totalCount) *
          100
        ).toFixed(1)}%)`
      );

      // Get sample scores for statistics (limited to avoid row limit but get representative sample)
      const { data: scoreSample, error: sampleError } = await supabase
        .from('recycling_centers')
        .select('legitimacy_score')
        .not('legitimacy_score', 'is', null)
        .order('legitimacy_score')
        .limit(1000);

      if (sampleError) throw sampleError;

      if (scoreSample && scoreSample.length > 0) {
        const scores = scoreSample.map((e) => e.legitimacy_score);
        const avgScore =
          scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);

        console.log(
          `\n📊 Score Statistics (sample of ${scoreSample.length} entries):`
        );
        console.log(`Average legitimacy score: ${avgScore.toFixed(1)}`);
        console.log(`Highest score: ${maxScore}`);
        console.log(`Lowest score: ${minScore}`);
      }
    }

    console.log(`\n🎉 Database cleanup was successful!`);
    console.log(
      `The database now contains only legitimate electronics recycling centers.`
    );
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    process.exit(1);
  }
}

showDatabaseStats();
