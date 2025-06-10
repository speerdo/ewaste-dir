import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

class DatabaseBranchSetup {
  constructor() {
    this.projectId = 'sjyuvagyndpdejxoapfb'; // Your EWaste Directory project
    this.organizationId = 'nstbxnbinvxvibinaugf'; // Your organization
  }

  async showSetupOptions() {
    console.log('\n🎯 DATABASE TESTING ENVIRONMENT SETUP');
    console.log('=====================================\n');

    console.log(
      'You have two options for safely testing the database updates:\n'
    );

    console.log('📋 OPTION 1: SUPABASE DEVELOPMENT BRANCH (Recommended)');
    console.log('   ✅ Pros:');
    console.log('      - Isolated environment with same schema');
    console.log('      - Easy merge back to production');
    console.log('      - All migrations automatically applied');
    console.log('      - Built-in safety features');
    console.log('   💰 Cost: $0.01344/hour (~$0.32/day or $9.68/month)');
    console.log('   ⏱️  Setup time: ~5 minutes\n');

    console.log('📋 OPTION 2: MANUAL DATABASE CLONE');
    console.log('   ✅ Pros:');
    console.log('      - Stays on free plan');
    console.log('      - Full control over setup');
    console.log('   ❌ Cons:');
    console.log('      - Manual export/import required');
    console.log('      - More complex setup');
    console.log('      - Manual merge back to production');
    console.log('   💰 Cost: Free');
    console.log('   ⏱️  Setup time: ~30-60 minutes\n');

    console.log('🔍 CURRENT PROJECT STATUS:');
    console.log(`   Project: EWaste Directory (${this.projectId})`);
    console.log(`   Organization: Adam Speer Web Dev (${this.organizationId})`);
    console.log('   Current Plan: Free');
    console.log('   Database: ~41,199 recycling centers');

    console.log('\n💡 RECOMMENDATION:');
    console.log(
      '   For this scale of updates (~14k+ scraped results + removals),'
    );
    console.log('   Option 1 (Development Branch) is strongly recommended.');
    console.log(
      '   The cost is minimal for a few days of testing, and the safety'
    );
    console.log('   and convenience benefits are significant.\n');
  }

  async setupDevelopmentBranch() {
    try {
      console.log('\n🚀 SETTING UP DEVELOPMENT BRANCH');
      console.log('=================================\n');

      console.log(
        '⚠️  IMPORTANT: This will upgrade your organization to Pro plan'
      );
      console.log('   Cost: $0.01344/hour for the branch');
      console.log('   You can downgrade after testing is complete\n');

      // Note: The actual branch creation would need to be done through the Supabase dashboard
      // or CLI since the MCP tools require manual confirmation
      console.log('📋 STEPS TO CREATE DEVELOPMENT BRANCH:');
      console.log(
        '   1. Visit https://supabase.com/dashboard/org/nstbxnbinvxvibinaugf/billing'
      );
      console.log('   2. Upgrade to Pro plan (you can downgrade later)');
      console.log('   3. Go to your EWaste Directory project dashboard');
      console.log('   4. Navigate to Branches section');
      console.log('   5. Create new branch named "database-updates-testing"');
      console.log('   6. Wait for branch to be ready (~3-5 minutes)');
      console.log('   7. Update your .env file with branch credentials\n');

      console.log('📝 AFTER BRANCH IS CREATED:');
      console.log('   1. Copy the branch URL and service role key');
      console.log('   2. Create .env.branch file with branch credentials:');
      console.log('      PUBLIC_SUPABASE_URL_BRANCH=your_branch_url');
      console.log(
        '      PUBLIC_SUPABASE_SERVICE_ROLE_KEY_BRANCH=your_branch_key'
      );
      console.log('   3. Run database update script with branch flag:');
      console.log('      node scripts/update-database.js --branch --dry-run');
      console.log('   4. Review changes, then run live:');
      console.log('      node scripts/update-database.js --branch --live\n');
    } catch (error) {
      console.error('Error in branch setup:', error);
    }
  }

  async setupManualClone() {
    console.log('\n🔧 MANUAL DATABASE CLONE SETUP');
    console.log('===============================\n');

    console.log('📋 STEPS FOR MANUAL CLONE:');
    console.log('   1. Create new Supabase project for testing');
    console.log('   2. Export production schema:');
    console.log('      pg_dump --schema-only [production_db] > schema.sql');
    console.log('   3. Import schema to test project:');
    console.log('      psql [test_db] < schema.sql');
    console.log('   4. Export essential data (states, cities):');
    console.log(
      '      pg_dump --data-only --table=states --table=cities [production_db] > reference_data.sql'
    );
    console.log('   5. Import reference data:');
    console.log('      psql [test_db] < reference_data.sql');
    console.log('   6. Export recycling_centers sample (optional):');
    console.log(
      '      pg_dump --data-only --table=recycling_centers [production_db] | head -n 1000 > sample_centers.sql'
    );
    console.log('   7. Update .env file with test project credentials');
    console.log('   8. Run update script against test database\n');

    console.log('⚠️  NOTE: This approach requires:');
    console.log('   - PostgreSQL command line tools');
    console.log('   - Direct database access');
    console.log('   - Manual merging of changes back to production\n');
  }

  async createBranchConfigTemplate() {
    const branchConfig = `# Supabase Branch Configuration
# Copy this to .env.branch and update with your branch credentials

# Production (original)
PUBLIC_SUPABASE_URL=${supabaseUrl}
PUBLIC_SUPABASE_SERVICE_ROLE_KEY=${supabaseKey}

# Development Branch (update these after creating branch)
PUBLIC_SUPABASE_URL_BRANCH=https://your-branch-ref.supabase.co
PUBLIC_SUPABASE_SERVICE_ROLE_KEY_BRANCH=your_branch_service_role_key

# Database Update Configuration
LEGITIMACY_THRESHOLD=25
SUSPICIOUS_THRESHOLD=-10
BATCH_SIZE=50
`;

    await fs.writeFile('.env.branch.template', branchConfig);
    console.log('✅ Created .env.branch.template file');
  }

  async displayCurrentDatabaseStats() {
    try {
      console.log('\n📊 CURRENT DATABASE STATISTICS');
      console.log('==============================\n');

      // Get table counts
      const { data: centers, error: centersError } = await supabase
        .from('recycling_centers')
        .select('*', { count: 'exact', head: true });

      if (centersError) throw centersError;

      const { data: states, error: statesError } = await supabase
        .from('states')
        .select('*', { count: 'exact', head: true });

      if (statesError) throw statesError;

      const { data: cities, error: citiesError } = await supabase
        .from('cities')
        .select('*', { count: 'exact', head: true });

      if (citiesError) throw citiesError;

      console.log(`📍 Recycling Centers: ${centers?.length || 'Unknown'}`);
      console.log(`🏛️  States: ${states?.length || 'Unknown'}`);
      console.log(`🏙️  Cities: ${cities?.length || 'Unknown'}`);

      // Estimate database size
      const estimatedSizeMB = Math.round(
        ((centers?.length || 40000) * 2) / 1000
      ); // ~2KB per center
      console.log(`💾 Estimated DB Size: ~${estimatedSizeMB}MB`);

      console.log('\n📈 EXPECTED UPDATE IMPACT:');
      console.log(`   🔄 Centers to update: ~2,000-4,000`);
      console.log(`   🗑️  Centers to remove: ~3,000-5,000`);
      console.log(`   📝 Descriptions to add: ~1,500-3,000`);
      console.log(`   🌐 Websites to update: ~1,000-2,000`);
    } catch (error) {
      console.error('Error fetching database stats:', error);
    }
  }

  async run() {
    await this.showSetupOptions();
    await this.displayCurrentDatabaseStats();

    console.log('\n🎯 NEXT STEPS:');
    console.log('==============\n');
    console.log('Choose your preferred option:');
    console.log('');
    console.log('For Development Branch (Option 1):');
    console.log('   node scripts/setup-database-branch.js --create-branch');
    console.log('');
    console.log('For Manual Clone (Option 2):');
    console.log('   node scripts/setup-database-branch.js --manual-clone');
    console.log('');
    console.log('To preview database updates without any environment:');
    console.log('   node scripts/update-database.js --dry-run');
    console.log('');
  }
}

// CLI handling
const args = process.argv.slice(2);

if (import.meta.url === new URL(import.meta.url).href) {
  const setup = new DatabaseBranchSetup();

  if (args.includes('--create-branch')) {
    setup.setupDevelopmentBranch();
  } else if (args.includes('--manual-clone')) {
    setup.setupManualClone();
  } else {
    setup.run();
  }
}

export { DatabaseBranchSetup };
