import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.branch' });

// Production client
const prodSupabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

// Branch client
const branchSupabase = createClient(
  process.env.PUBLIC_SUPABASE_URL_BRANCH,
  process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY_BRANCH
);

async function copyData() {
  try {
    console.log('🚀 Starting data copy from production to branch...');

    // Get production data in chunks
    const BATCH_SIZE = 1000;
    let start = 0;
    let totalCopied = 0;

    while (true) {
      console.log(`📦 Fetching batch starting at ${start}...`);

      // Fetch batch from production
      const { data: prodData, error: fetchError } = await prodSupabase
        .from('recycling_centers')
        .select('*')
        .range(start, start + BATCH_SIZE - 1);

      if (fetchError) {
        throw fetchError;
      }

      if (!prodData || prodData.length === 0) {
        console.log('✅ No more data to copy');
        break;
      }

      console.log(`📝 Copying ${prodData.length} centers to branch...`);

      // Insert batch to branch
      const { error: insertError } = await branchSupabase
        .from('recycling_centers')
        .insert(prodData);

      if (insertError) {
        throw insertError;
      }

      totalCopied += prodData.length;
      console.log(`✅ Copied batch successfully. Total: ${totalCopied}`);

      // If we got less than BATCH_SIZE, we're done
      if (prodData.length < BATCH_SIZE) {
        break;
      }

      start += BATCH_SIZE;
    }

    console.log(`🎉 Data copy complete! Total centers copied: ${totalCopied}`);

    // Verify the copy
    const { count, error: countError } = await branchSupabase
      .from('recycling_centers')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`✅ Verification: Branch database now has ${count} centers`);
  } catch (error) {
    console.error('❌ Error copying data:', error);
  }
}

// Run the copy
copyData();
