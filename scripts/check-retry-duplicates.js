import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = './data/scraped_data';

class RetryDuplicateChecker {
  constructor() {
    this.allResults = [];
    this.centerIdMap = new Map();
    this.duplicates = [];
    this.stats = {
      totalFiles: 0,
      totalResults: 0,
      uniqueCenters: 0,
      duplicatedCenters: 0,
      successfulRetries: 0,
      failedRetries: 0,
    };
  }

  async loadAllRetryResults() {
    try {
      const files = await fs.readdir(DATA_DIR);
      const retryFiles = files.filter(
        (f) => f.startsWith('retry_results_') && f.endsWith('.json')
      );

      console.log(`📂 Found ${retryFiles.length} retry result files\n`);
      this.stats.totalFiles = retryFiles.length;

      for (const file of retryFiles) {
        const filePath = path.join(DATA_DIR, file);
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const results = JSON.parse(data);

          console.log(`   📄 ${file}: ${results.length} results`);

          for (const result of results) {
            this.processResult(result, file);
          }

          this.allResults.push(...results);
          this.stats.totalResults += results.length;
        } catch (error) {
          console.warn(`   ⚠️  Could not parse ${file}: ${error.message}`);
        }
      }

      console.log(`\n📊 Loaded ${this.stats.totalResults} total retry results`);
    } catch (error) {
      console.error(`❌ Error reading retry files: ${error.message}`);
    }
  }

  processResult(result, fileName) {
    const centerId = result.centerId;

    if (this.centerIdMap.has(centerId)) {
      // Duplicate found
      const existing = this.centerIdMap.get(centerId);
      this.duplicates.push({
        centerId,
        centerName: result.centerName,
        existing: {
          file: existing.file,
          success: existing.result.success,
          scrapedAt: existing.result.scrapedAt,
        },
        current: {
          file: fileName,
          success: result.success,
          scrapedAt: result.scrapedAt,
        },
      });

      // Keep the more recent result or the successful one
      if (result.success && !existing.result.success) {
        // Current is successful, existing failed - replace
        this.centerIdMap.set(centerId, { result, file: fileName });
      } else if (!result.success && existing.result.success) {
        // Current failed, existing successful - keep existing
        // No action needed
      } else {
        // Both same success status, keep more recent
        const currentTime = new Date(result.scrapedAt);
        const existingTime = new Date(existing.result.scrapedAt);
        if (currentTime > existingTime) {
          this.centerIdMap.set(centerId, { result, file: fileName });
        }
      }
    } else {
      // First occurrence
      this.centerIdMap.set(centerId, { result, file: fileName });
    }

    // Track success/failure stats
    if (result.success) {
      this.stats.successfulRetries++;
    } else {
      this.stats.failedRetries++;
    }
  }

  generateReport() {
    this.stats.uniqueCenters = this.centerIdMap.size;
    this.stats.duplicatedCenters = this.duplicates.length;

    console.log('\n🔍 DUPLICATE ANALYSIS REPORT');
    console.log('=====================================');
    console.log(`📂 Total retry files processed: ${this.stats.totalFiles}`);
    console.log(`📄 Total retry results loaded: ${this.stats.totalResults}`);
    console.log(`🎯 Unique centers found: ${this.stats.uniqueCenters}`);
    console.log(`🔄 Centers with duplicates: ${this.stats.duplicatedCenters}`);
    console.log(`✅ Successful retries: ${this.stats.successfulRetries}`);
    console.log(`❌ Failed retries: ${this.stats.failedRetries}`);
    console.log(
      `📊 Success rate: ${(
        (this.stats.successfulRetries / this.stats.totalResults) *
        100
      ).toFixed(1)}%`
    );

    if (this.duplicates.length > 0) {
      console.log(
        `\n⚠️  DUPLICATES FOUND (${this.duplicates.length} centers):`
      );
      console.log('=====================================');

      // Show first 10 duplicates as examples
      const examples = this.duplicates.slice(0, 10);
      for (const dup of examples) {
        console.log(`\n🔄 Center ${dup.centerId}: ${dup.centerName}`);
        console.log(`   📄 File 1: ${dup.existing.file}`);
        console.log(
          `      Status: ${dup.existing.success ? '✅ Success' : '❌ Failed'}`
        );
        console.log(`      Time: ${dup.existing.scrapedAt}`);
        console.log(`   📄 File 2: ${dup.current.file}`);
        console.log(
          `      Status: ${dup.current.success ? '✅ Success' : '❌ Failed'}`
        );
        console.log(`      Time: ${dup.current.scrapedAt}`);
      }

      if (this.duplicates.length > 10) {
        console.log(
          `   ... and ${this.duplicates.length - 10} more duplicates`
        );
      }
    } else {
      console.log('\n✅ NO DUPLICATES FOUND - Data is clean!');
    }
  }

  async generateCleanedData() {
    if (this.duplicates.length === 0) {
      console.log('\n✅ No cleaning needed - retry data is already clean!');
      return;
    }

    console.log('\n🧹 GENERATING CLEANED DATA');
    console.log('============================');

    // Get unique results (deduped)
    const uniqueResults = Array.from(this.centerIdMap.values()).map(
      (item) => item.result
    );

    // Save cleaned data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanedFilePath = path.join(
      DATA_DIR,
      `retry_results_cleaned_${timestamp}.json`
    );

    await fs.writeFile(cleanedFilePath, JSON.stringify(uniqueResults, null, 2));

    console.log(`💾 Saved ${uniqueResults.length} unique results to:`);
    console.log(`   ${cleanedFilePath}`);

    // Save duplicate report
    const reportPath = path.join(
      DATA_DIR,
      `duplicate_analysis_${timestamp}.json`
    );
    const report = {
      stats: this.stats,
      duplicates: this.duplicates,
      generatedAt: new Date().toISOString(),
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📋 Saved duplicate analysis report to:`);
    console.log(`   ${reportPath}`);
  }

  async checkDataIntegrity() {
    console.log('\n🔍 CHECKING DATA INTEGRITY');
    console.log('============================');

    const uniqueResults = Array.from(this.centerIdMap.values()).map(
      (item) => item.result
    );

    // Check for missing required fields
    const missingFields = [];
    const invalidDates = [];
    const centerNameMap = new Map();

    for (const result of uniqueResults) {
      // Check required fields
      if (!result.centerId)
        missingFields.push({ issue: 'Missing centerId', result });
      if (!result.centerName)
        missingFields.push({ issue: 'Missing centerName', result });
      if (!result.scrapedAt)
        missingFields.push({ issue: 'Missing scrapedAt', result });

      // Check date validity
      if (result.scrapedAt && isNaN(new Date(result.scrapedAt))) {
        invalidDates.push({
          centerId: result.centerId,
          scrapedAt: result.scrapedAt,
        });
      }

      // Check for centers with different names (potential data corruption)
      if (centerNameMap.has(result.centerId)) {
        const existingName = centerNameMap.get(result.centerId);
        if (existingName !== result.centerName) {
          console.log(`⚠️  Center ${result.centerId} has different names:`);
          console.log(`   "${existingName}" vs "${result.centerName}"`);
        }
      } else {
        centerNameMap.set(result.centerId, result.centerName);
      }
    }

    if (missingFields.length === 0 && invalidDates.length === 0) {
      console.log(
        '✅ Data integrity check passed - all required fields present and valid!'
      );
    } else {
      if (missingFields.length > 0) {
        console.log(
          `❌ Found ${missingFields.length} results with missing required fields`
        );
      }
      if (invalidDates.length > 0) {
        console.log(
          `❌ Found ${invalidDates.length} results with invalid dates`
        );
      }
    }
  }

  async run() {
    console.log('🔍 RETRY DATA DUPLICATE CHECKER');
    console.log('=================================\n');

    await this.loadAllRetryResults();
    this.generateReport();
    await this.checkDataIntegrity();
    await this.generateCleanedData();

    console.log('\n🎉 Analysis complete!');

    if (this.duplicates.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('   1. Review the duplicate analysis report');
      console.log('   2. Use the cleaned data file for database updates');
      console.log('   3. Consider cleaning up original retry result files');
    }
  }
}

// Run the duplicate checker
const checker = new RetryDuplicateChecker();
checker.run().catch(console.error);
