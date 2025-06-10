import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// CLI handling for environment selection
const args = process.argv.slice(2);
const useBranch = args.includes('--branch');
const isDryRun = !args.includes('--live');

// Initialize Supabase client based on environment
let supabaseUrl, supabaseKey;

if (useBranch) {
  supabaseUrl = process.env.PUBLIC_SUPABASE_URL_BRANCH;
  supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY_BRANCH;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '❌ Missing Supabase BRANCH credentials. Please ensure these environment variables are set:'
    );
    console.error('   - PUBLIC_SUPABASE_URL_BRANCH');
    console.error('   - PUBLIC_SUPABASE_SERVICE_ROLE_KEY_BRANCH');
    console.error(
      '\n💡 Create .env.branch file or add branch credentials to your .env file'
    );
    process.exit(1);
  }
  console.log('🌿 Using BRANCH environment for testing');
} else {
  supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '❌ Missing Supabase credentials. Please ensure these environment variables are set:'
    );
    console.error('   - PUBLIC_SUPABASE_URL');
    console.error('   - PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log('🏗️  Using PRODUCTION environment');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CONFIG = {
  SCRAPED_DATA_DIR: './data/scraped_data',
  PLACES_RESEARCH_DIR: './data/places_research',
  FINAL_SCRAPING_DIR: './data/final_scraping_results',
  BATCH_SIZE: 50,
  LEGITIMACY_THRESHOLD: 25, // Minimum score to keep a center
  SUSPICIOUS_THRESHOLD: -10, // Below this score, definitely remove
  DRY_RUN: false, // Set to true to preview changes without making them
};

class DatabaseUpdater {
  constructor(options = {}) {
    this.processedCount = 0;
    this.updatedDescriptions = 0;
    this.updatedWebsites = 0;
    this.flaggedSuspicious = 0;
    this.centersToRemove = [];
    this.centersUpdated = [];
    this.errors = [];
    this.dryRun = options.dryRun || CONFIG.DRY_RUN;

    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made to the database');
    }
  }

  async loadAllScrapingData() {
    try {
      const allResults = [];

      // 1. Load original scraping results
      const originalResults = await this.loadOriginalScrapingData();
      allResults.push(...originalResults);

      // 2. Load retry results
      const retryResults = await this.loadRetryScrapingData();
      allResults.push(...retryResults);

      // 3. Load final alternative scraping results
      const finalResults = await this.loadFinalScrapingData();
      allResults.push(...finalResults);

      console.log(`Loaded ${allResults.length} total scraped results`);

      // Remove duplicates - prefer most recent/successful results
      const deduplicatedResults = this.deduplicateResults(allResults);
      console.log(
        `After deduplication: ${deduplicatedResults.length} unique results`
      );

      return deduplicatedResults;
    } catch (error) {
      console.error('Error loading scraped data:', error);
      return [];
    }
  }

  async loadOriginalScrapingData() {
    try {
      const files = await fs.readdir(CONFIG.SCRAPED_DATA_DIR);
      const scrapingFiles = files.filter(
        (f) => f.startsWith('scraping_results_') && f.endsWith('.json')
      );

      let results = [];
      for (const file of scrapingFiles) {
        const filePath = path.join(CONFIG.SCRAPED_DATA_DIR, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const fileResults = JSON.parse(data);
        results = results.concat(fileResults);
      }

      console.log(`Loaded ${results.length} original scraping results`);
      return results;
    } catch (error) {
      console.log('No original scraping results found');
      return [];
    }
  }

  async loadRetryScrapingData() {
    try {
      const files = await fs.readdir(CONFIG.SCRAPED_DATA_DIR);

      // Prioritize cleaned retry files over individual retry files
      const cleanedRetryFiles = files.filter(
        (f) => f.startsWith('retry_results_cleaned_') && f.endsWith('.json')
      );
      const individualRetryFiles = files.filter(
        (f) =>
          f.startsWith('retry_results_') &&
          f.endsWith('.json') &&
          !f.startsWith('retry_results_cleaned_')
      );

      const retryFiles =
        cleanedRetryFiles.length > 0 ? cleanedRetryFiles : individualRetryFiles;

      let results = [];
      for (const file of retryFiles) {
        const filePath = path.join(CONFIG.SCRAPED_DATA_DIR, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const fileResults = JSON.parse(data);
        results = results.concat(fileResults);
      }

      console.log(`Loaded ${results.length} retry scraping results`);
      return results;
    } catch (error) {
      console.log('No retry scraping results found');
      return [];
    }
  }

  async loadFinalScrapingData() {
    try {
      // Check if final scraping directory exists
      try {
        await fs.access(CONFIG.FINAL_SCRAPING_DIR);
      } catch {
        console.log('No final scraping results directory found');
        return [];
      }

      const files = await fs.readdir(CONFIG.FINAL_SCRAPING_DIR);
      const finalFiles = files.filter(
        (f) => f.startsWith('final_scraping_results_') && f.endsWith('.json')
      );

      let results = [];
      for (const file of finalFiles) {
        const filePath = path.join(CONFIG.FINAL_SCRAPING_DIR, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const fileResults = JSON.parse(data);
        results = results.concat(fileResults);
      }

      console.log(
        `Loaded ${results.length} final alternative scraping results`
      );
      return results;
    } catch (error) {
      console.log('No final scraping results found');
      return [];
    }
  }

  deduplicateResults(results) {
    // Create a map to store the best result for each center ID
    const centerMap = new Map();

    for (const result of results) {
      const centerId = result.centerId;
      const existing = centerMap.get(centerId);

      if (!existing) {
        centerMap.set(centerId, result);
      } else {
        // Priority order:
        // 1. Final scraping results (most recent)
        // 2. Successful results over failed ones
        // 3. Retry results over original results
        // 4. More recent timestamps

        const isCurrentFinal = result.source === 'final-alternative-scraper';
        const isExistingFinal = existing.source === 'final-alternative-scraper';

        if (isCurrentFinal && !isExistingFinal) {
          centerMap.set(centerId, result);
        } else if (!isCurrentFinal && isExistingFinal) {
          // Keep existing
        } else if (result.success && !existing.success) {
          centerMap.set(centerId, result);
        } else if (!result.success && existing.success) {
          // Keep existing
        } else if (result.retryAttempt && !existing.retryAttempt) {
          centerMap.set(centerId, result);
        } else if (!result.retryAttempt && existing.retryAttempt) {
          // Keep existing
        } else if (new Date(result.scrapedAt) > new Date(existing.scrapedAt)) {
          centerMap.set(centerId, result);
        }
      }
    }

    return Array.from(centerMap.values());
  }

  async loadManualReviewCenters() {
    try {
      const filePath = path.join(
        CONFIG.PLACES_RESEARCH_DIR,
        'manual_review_centers.csv'
      );
      const csvData = await fs.readFile(filePath, 'utf-8');

      const lines = csvData.split('\n').slice(1); // Skip header
      const centers = lines
        .filter((line) => line.trim())
        .map((line) => {
          const [id, name, city, state, url, issues, priority, legitimacy] =
            line.split(',').map((s) => s.replace(/"/g, '').trim());
          return {
            id,
            name,
            city,
            state,
            url: url === 'NULL' ? null : url,
            issues,
            priority: parseInt(priority) || 0,
            legitimacy: parseInt(legitimacy) || 0,
          };
        });

      console.log(`Loaded ${centers.length} manual review centers`);
      return centers;
    } catch (error) {
      console.log('No manual review centers file found');
      return [];
    }
  }

  async identifyCentersForRemoval(scrapingResults) {
    try {
      console.log('\n🔍 Identifying centers for removal...');

      // Get all current centers from database
      const { data: allCenters, error } = await supabase
        .from('recycling_centers')
        .select('id, name, city, state, site');

      if (error) {
        throw error;
      }

      console.log(`Found ${allCenters.length} total centers in database`);

      // Load manual review centers
      const manualReviewCenters = await this.loadManualReviewCenters();
      const manualReviewIds = new Set(manualReviewCenters.map((c) => c.id));

      // Create lookup for scraping results
      const scrapingResultsMap = new Map();
      scrapingResults.forEach((result) => {
        scrapingResultsMap.set(result.centerId, result);
      });

      const centersToRemove = [];

      for (const center of allCenters) {
        const scrapingResult = scrapingResultsMap.get(center.id);
        let shouldRemove = false;
        let removalReason = '';

        // Rule 1: Centers that failed all scraping attempts
        if (!scrapingResult) {
          if (manualReviewIds.has(center.id)) {
            shouldRemove = true;
            removalReason = 'Failed all scraping attempts (manual review list)';
          }
        }
        // Rule 2: Centers with failed scraping
        else if (!scrapingResult.success) {
          shouldRemove = true;
          removalReason = 'Scraping failed - website inaccessible';
        }
        // Rule 3: Centers with suspicious legitimacy scores
        else if (
          scrapingResult.isSuspicious ||
          scrapingResult.legitimacyScore < CONFIG.LEGITIMACY_THRESHOLD
        ) {
          shouldRemove = true;
          removalReason = `Low legitimacy score (${scrapingResult.legitimacyScore}) - ${scrapingResult.legitimacyReason}`;
        }
        // Rule 4: Centers below suspicious threshold
        else if (scrapingResult.legitimacyScore < CONFIG.SUSPICIOUS_THRESHOLD) {
          shouldRemove = true;
          removalReason = `Highly suspicious business (${scrapingResult.legitimacyScore}) - ${scrapingResult.legitimacyReason}`;
        }

        if (shouldRemove) {
          centersToRemove.push({
            id: center.id,
            name: center.name,
            city: center.city,
            state: center.state,
            website: center.site,
            reason: removalReason,
            legitimacyScore: scrapingResult?.legitimacyScore || null,
            legitimacyReason: scrapingResult?.legitimacyReason || null,
          });
        }
      }

      console.log(`Identified ${centersToRemove.length} centers for removal`);
      this.centersToRemove = centersToRemove;

      return centersToRemove;
    } catch (error) {
      console.error('Error identifying centers for removal:', error);
      return [];
    }
  }

  async updateCenterInDatabase(result) {
    try {
      const updates = {};
      let shouldUpdate = false;

      // Update description if we have a good one
      if (
        result.suggestedDescription &&
        result.suggestedDescription.length > 50
      ) {
        updates.description = result.suggestedDescription;
        shouldUpdate = true;
        this.updatedDescriptions++;
      }

      // Update website if we found a new one
      if (result.url && result.url !== 'Not found') {
        updates.site = result.url;
        shouldUpdate = true;
        this.updatedWebsites++;
      }

      // Add legitimacy metadata
      if (result.legitimacyScore !== undefined) {
        updates.legitimacy_score = result.legitimacyScore;
        updates.legitimacy_reason = result.legitimacyReason;
        updates.is_legitimate = result.isLegitimate;
        updates.is_suspicious = result.isSuspicious;
        updates.scraped_at = result.scrapedAt;
        shouldUpdate = true;

        if (result.isSuspicious) {
          this.flaggedSuspicious++;
        }
      }

      // Update contact info if we found better data
      if (result.contactInfo?.phones?.length > 0) {
        updates.phone = result.contactInfo.phones[0];
        shouldUpdate = true;
      }

      if (shouldUpdate && !this.dryRun) {
        updates.updated_at = new Date().toISOString();

        const { error } = await supabase
          .from('recycling_centers')
          .update(updates)
          .eq('id', result.centerId);

        if (error) {
          throw error;
        }

        console.log(`✓ Updated ${result.centerName}`);
        this.processedCount++;
        this.centersUpdated.push({
          id: result.centerId,
          name: result.centerName,
          updates: Object.keys(updates),
        });
        return true;
      } else if (shouldUpdate && this.dryRun) {
        console.log(
          `🔍 Would update ${result.centerName} with: ${Object.keys(
            updates
          ).join(', ')}`
        );
        this.processedCount++;
        return true;
      } else {
        console.log(`- No updates needed for ${result.centerName}`);
        return false;
      }
    } catch (error) {
      console.error(`Error updating ${result.centerName}:`, error);
      this.errors.push({
        centerId: result.centerId,
        centerName: result.centerName,
        error: error.message,
      });
      return false;
    }
  }

  async removeCentersFromDatabase(centersToRemove) {
    if (centersToRemove.length === 0) {
      console.log('No centers marked for removal');
      return;
    }

    console.log(
      `\n🗑️  ${this.dryRun ? 'Would remove' : 'Removing'} ${
        centersToRemove.length
      } centers...`
    );

    if (!this.dryRun) {
      // Remove in batches
      for (let i = 0; i < centersToRemove.length; i += CONFIG.BATCH_SIZE) {
        const batch = centersToRemove.slice(i, i + CONFIG.BATCH_SIZE);
        const centerIds = batch.map((c) => c.id);

        const { error } = await supabase
          .from('recycling_centers')
          .delete()
          .in('id', centerIds);

        if (error) {
          console.error(`Error removing batch ${i + 1}:`, error);
          this.errors.push({
            batch: i + 1,
            centerIds,
            error: error.message,
          });
        } else {
          console.log(
            `✓ Removed batch ${
              Math.floor(i / CONFIG.BATCH_SIZE) + 1
            }/${Math.ceil(centersToRemove.length / CONFIG.BATCH_SIZE)} (${
              batch.length
            } centers)`
          );
        }
      }
    } else {
      centersToRemove.forEach((center) => {
        console.log(
          `🔍 Would remove: ${center.name} (${center.city}, ${center.state}) - ${center.reason}`
        );
      });
    }
  }

  async addLegitimacyColumns() {
    try {
      console.log('Checking/adding legitimacy tracking columns...');

      if (!this.dryRun) {
        // Try to add columns - will silently fail if they already exist
        const alterTableQuery = `
          ALTER TABLE recycling_centers 
          ADD COLUMN IF NOT EXISTS legitimacy_score INTEGER,
          ADD COLUMN IF NOT EXISTS legitimacy_reason TEXT,
          ADD COLUMN IF NOT EXISTS is_legitimate BOOLEAN,
          ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN,
          ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;
        `;

        const { error } = await supabase.rpc('sql', { query: alterTableQuery });

        if (error && !error.message.includes('already exists')) {
          console.log(
            'Note: Could not add legitimacy columns via RPC. You may need to add them manually:'
          );
          console.log('- legitimacy_score INTEGER');
          console.log('- legitimacy_reason TEXT');
          console.log('- is_legitimate BOOLEAN');
          console.log('- is_suspicious BOOLEAN');
          console.log('- scraped_at TIMESTAMPTZ');
        } else {
          console.log('✓ Legitimacy tracking columns ready');
        }
      } else {
        console.log('🔍 Would ensure legitimacy tracking columns exist');
      }
    } catch (error) {
      console.log('Note: Legitimacy columns may need to be added manually');
    }
  }

  async generateRemovalReport() {
    if (this.centersToRemove.length === 0) return;

    // Group removal reasons
    const removalStats = {};
    this.centersToRemove.forEach((center) => {
      const reason = center.reason.split(' - ')[0]; // Get primary reason
      removalStats[reason] = (removalStats[reason] || 0) + 1;
    });

    // Save detailed removal list
    await fs.writeFile(
      path.join(CONFIG.SCRAPED_DATA_DIR, 'centers_to_remove.json'),
      JSON.stringify(this.centersToRemove, null, 2)
    );

    // Create CSV for easier review
    const csvHeader =
      'ID,Name,City,State,Website,Reason,Legitimacy Score,Legitimacy Details\n';
    const csvRows = this.centersToRemove
      .map(
        (c) =>
          `"${c.id}","${c.name}","${c.city}","${c.state}","${
            c.website || ''
          }","${c.reason}","${c.legitimacyScore || ''}","${
            c.legitimacyReason || ''
          }"`
      )
      .join('\n');

    await fs.writeFile(
      path.join(CONFIG.SCRAPED_DATA_DIR, 'centers_to_remove.csv'),
      csvHeader + csvRows
    );

    console.log('\n📊 Removal Statistics:');
    Object.entries(removalStats).forEach(([reason, count]) => {
      console.log(`   ${reason}: ${count} centers`);
    });
  }

  async run(options = {}) {
    try {
      const startTime = Date.now();
      console.log(
        `\n🚀 Starting database update process${
          this.dryRun ? ' (DRY RUN)' : ''
        }...`
      );

      // Add legitimacy columns if they don't exist
      await this.addLegitimacyColumns();

      // Load all scraped data from all sources
      const allResults = await this.loadAllScrapingData();

      if (allResults.length === 0) {
        console.log('❌ No scraped data found to process');
        return;
      }

      // Identify centers for removal
      const centersToRemove = await this.identifyCentersForRemoval(allResults);

      // Filter out centers marked for removal from updates
      const successfulResults = allResults.filter(
        (r) =>
          r.success &&
          r.legitimacyScore >= CONFIG.LEGITIMACY_THRESHOLD &&
          !r.isSuspicious
      );

      console.log(`\n📊 Processing Summary:`);
      console.log(`   Total scraped results: ${allResults.length}`);
      console.log(`   Centers to update: ${successfulResults.length}`);
      console.log(`   Centers to remove: ${centersToRemove.length}`);

      // Process updates in batches
      if (successfulResults.length > 0) {
        console.log(
          `\n📝 ${this.dryRun ? 'Previewing' : 'Processing'} center updates...`
        );

        for (let i = 0; i < successfulResults.length; i += CONFIG.BATCH_SIZE) {
          const batch = successfulResults.slice(i, i + CONFIG.BATCH_SIZE);
          const currentBatch = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(
            successfulResults.length / CONFIG.BATCH_SIZE
          );

          console.log(
            `\nBatch ${currentBatch}/${totalBatches} (${batch.length} centers)...`
          );

          const batchPromises = batch.map((result) =>
            this.updateCenterInDatabase(result)
          );
          await Promise.all(batchPromises);

          console.log(`Batch ${currentBatch} complete`);
        }
      }

      // Process removals
      await this.removeCentersFromDatabase(centersToRemove);

      // Generate reports
      await this.generateRemovalReport();
      await this.generateFinalSummaryReport(
        allResults,
        centersToRemove,
        Date.now() - startTime
      );
    } catch (error) {
      console.error('❌ Database update failed:', error);
      throw error;
    }
  }

  async generateFinalSummaryReport(allResults, centersToRemove, executionTime) {
    const summary = {
      dryRun: this.dryRun,
      executionTimeMs: executionTime,
      totalScrapedResults: allResults.length,
      successfulScrapes: allResults.filter((r) => r.success).length,
      failedScrapes: allResults.filter((r) => !r.success).length,
      centersUpdated: this.processedCount,
      descriptionsUpdated: this.updatedDescriptions,
      websitesUpdated: this.updatedWebsites,
      centersRemoved: centersToRemove.length,
      suspiciousCenters: this.flaggedSuspicious,
      legitimateBusinesses: allResults.filter((r) => r.isLegitimate).length,
      errors: this.errors.length,
      completedAt: new Date().toISOString(),
      removalReasons: {},
    };

    // Summarize removal reasons
    centersToRemove.forEach((center) => {
      const reason = center.reason.split(' - ')[0];
      summary.removalReasons[reason] =
        (summary.removalReasons[reason] || 0) + 1;
    });

    const filename = this.dryRun
      ? 'database_update_preview.json'
      : 'database_update_summary.json';
    await fs.writeFile(
      path.join(CONFIG.SCRAPED_DATA_DIR, filename),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n' + '='.repeat(60));
    console.log(
      `${
        this.dryRun
          ? '🔍 DATABASE UPDATE PREVIEW'
          : '✅ DATABASE UPDATE COMPLETE'
      }`
    );
    console.log('='.repeat(60));
    console.log(`Execution time: ${Math.round(executionTime / 1000)}s`);
    console.log(`Total scraped results: ${summary.totalScrapedResults}`);
    console.log(`Successful scrapes: ${summary.successfulScrapes}`);
    console.log(`Centers updated: ${summary.centersUpdated}`);
    console.log(`  - Descriptions updated: ${summary.descriptionsUpdated}`);
    console.log(`  - Websites updated: ${summary.websitesUpdated}`);
    console.log(
      `Centers ${this.dryRun ? 'to be removed' : 'removed'}: ${
        summary.centersRemoved
      }`
    );
    console.log(
      `Legitimate businesses confirmed: ${summary.legitimateBusinesses}`
    );
    console.log(`Errors: ${summary.errors}`);

    if (centersToRemove.length > 0) {
      console.log('\n📋 Removal breakdown:');
      Object.entries(summary.removalReasons).forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count} centers`);
      });
    }

    if (this.dryRun) {
      console.log('\n💡 To apply these changes, run with --live flag');
    }
  }
}

// Run the database updater
if (import.meta.url === new URL(import.meta.url).href) {
  const updater = new DatabaseUpdater({ dryRun: isDryRun });
  updater.run().catch(console.error);
}

export { DatabaseUpdater };
