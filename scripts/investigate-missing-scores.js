#!/usr/bin/env node

/**
 * Missing Legitimacy Scores Investigation Script
 *
 * This script investigates the gap between scraped data files and database legitimacy scores.
 * Based on analysis, we have:
 * - 9,343 unscored entries in database
 * - 41,196 total scraped results in files
 * - 27,995 centers updated according to summary
 * - Additional 4,390 retry successes
 * - Additional 8,773 from places research
 *
 * Total potential legitimate businesses: ~29,548+, but only 22,341 have scores in DB
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class MissingScoresInvestigator {
  constructor() {
    this.results = {
      unscored_in_db: 0,
      scraped_files_found: 0,
      missing_updates: [],
      potential_updates: [],
      suspicious_patterns: [],
    };
  }

  async getUnscoredEntries() {
    console.log('🔍 Analyzing unscored entries in database...');

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('id, name, city, state, phone, site')
      .is('legitimacy_score', null)
      .order('name');

    if (error) {
      throw new Error(`Error fetching unscored entries: ${error.message}`);
    }

    this.results.unscored_in_db = data.length;
    console.log(`   Found ${data.length} unscored entries`);

    // Analyze patterns in unscored entries
    const patterns = {
      walmart: data.filter((c) => c.name?.toLowerCase().includes('walmart'))
        .length,
      cvs: data.filter((c) => c.name?.toLowerCase().includes('cvs')).length,
      auto: data.filter((c) => c.name?.toLowerCase().includes('auto')).length,
      hardware: data.filter((c) => c.name?.toLowerCase().includes('hardware'))
        .length,
      transfer_station: data.filter((c) =>
        c.name?.toLowerCase().includes('transfer station')
      ).length,
      municipal: data.filter(
        (c) =>
          c.name?.toLowerCase().includes('municipal') ||
          c.name?.toLowerCase().includes('city of') ||
          c.name?.toLowerCase().includes('county')
      ).length,
      no_website: data.filter((c) => !c.site).length,
      has_website: data.filter((c) => c.site).length,
    };

    console.log('   📊 Unscored entry patterns:');
    Object.entries(patterns).forEach(([pattern, count]) => {
      console.log(`      ${pattern}: ${count}`);
    });

    return data;
  }

  async loadScrapingResultsFiles() {
    console.log('\n📁 Loading scraping results from data files...');

    const scraped_data = [];
    const data_dirs = [
      'data/scraped_data',
      'data/final_scraping_results',
      'data/places_research',
    ];

    // Load retry results (most recent cleaned file)
    try {
      const retryFile =
        'data/scraped_data/retry_results_cleaned_2025-06-10T10-49-09-122Z.json';
      const retryData = JSON.parse(await fs.readFile(retryFile, 'utf8'));
      scraped_data.push(...retryData);
      console.log(`   📄 Loaded ${retryData.length} retry results`);
    } catch (error) {
      console.log(`   ⚠️  Could not load retry results: ${error.message}`);
    }

    // Load most recent final scraping results
    try {
      const finalFile =
        'data/final_scraping_results/final_scraping_results_phase1_2025-06-10T13-28-58-244Z.json';
      const finalData = JSON.parse(await fs.readFile(finalFile, 'utf8'));
      scraped_data.push(...finalData);
      console.log(`   📄 Loaded ${finalData.length} final scraping results`);
    } catch (error) {
      console.log(`   ⚠️  Could not load final results: ${error.message}`);
    }

    // Load places research data
    try {
      const placesFile = 'data/places_research/manual_review_centers.json';
      const placesData = JSON.parse(await fs.readFile(placesFile, 'utf8'));
      scraped_data.push(...placesData);
      console.log(`   📄 Loaded ${placesData.length} places research results`);
    } catch (error) {
      console.log(`   ⚠️  Could not load places research: ${error.message}`);
    }

    this.results.scraped_files_found = scraped_data.length;
    console.log(`   ✅ Total scraped results loaded: ${scraped_data.length}`);

    return scraped_data;
  }

  async findMissingUpdates(unscoredEntries, scrapingResults) {
    console.log(
      '\n🔄 Finding entries with scraped data but missing database scores...'
    );

    // Create lookup map for faster searching
    const scrapedMap = new Map();
    scrapingResults.forEach((result) => {
      if (result.centerId) {
        scrapedMap.set(result.centerId, result);
      }
    });

    const missingUpdates = [];
    const potentialUpdates = [];

    for (const entry of unscoredEntries) {
      const scrapedData = scrapedMap.get(entry.id);

      if (scrapedData) {
        if (scrapedData.legitimacyScore !== undefined) {
          missingUpdates.push({
            id: entry.id,
            name: entry.name,
            city: entry.city,
            state: entry.state,
            current_score: null,
            scraped_score: scrapedData.legitimacyScore,
            scraped_reason: scrapedData.legitimacyReason,
            is_legitimate: scrapedData.isLegitimate,
            is_suspicious: scrapedData.isSuspicious,
            source: scrapedData.source || 'unknown',
          });
        } else if (scrapedData.finalLegitimacyScore !== undefined) {
          missingUpdates.push({
            id: entry.id,
            name: entry.name,
            city: entry.city,
            state: entry.state,
            current_score: null,
            scraped_score: scrapedData.finalLegitimacyScore,
            scraped_reason: scrapedData.legitimacyReason,
            is_legitimate: scrapedData.isLegitimate,
            is_suspicious: scrapedData.isSuspicious,
            source: 'final_scraping',
          });
        } else {
          potentialUpdates.push({
            id: entry.id,
            name: entry.name,
            city: entry.city,
            state: entry.state,
            scraped_data_exists: true,
            has_website: scrapedData.url ? true : false,
            website: scrapedData.url,
          });
        }
      }
    }

    this.results.missing_updates = missingUpdates;
    this.results.potential_updates = potentialUpdates;

    console.log(
      `   🎯 Found ${missingUpdates.length} entries with scores ready to upload`
    );
    console.log(
      `   📝 Found ${potentialUpdates.length} entries with scraped data but no scores`
    );

    return { missingUpdates, potentialUpdates };
  }

  async identifySuspiciousPatterns(unscoredEntries) {
    console.log('\n🚨 Identifying suspicious patterns in unscored entries...');

    const suspicious = [];

    // Known problematic business types
    const problematic_patterns = [
      { pattern: 'cvs', reason: 'Pharmacy - unlikely to recycle electronics' },
      {
        pattern: 'walgreens',
        reason: 'Pharmacy - unlikely to recycle electronics',
      },
      {
        pattern: 'funeral',
        reason: 'Funeral home - not electronics recycling',
      },
      {
        pattern: 'restaurant',
        reason: 'Restaurant - not electronics recycling',
      },
      { pattern: 'hotel', reason: 'Hotel - not electronics recycling' },
      { pattern: 'bank', reason: 'Bank - not electronics recycling' },
      {
        pattern: 'hair salon',
        reason: 'Hair salon - not electronics recycling',
      },
      {
        pattern: 'dental',
        reason: 'Dental office - not electronics recycling',
      },
      {
        pattern: 'medical',
        reason: 'Medical office - not electronics recycling',
      },
      {
        pattern: 'plumbing',
        reason: 'Plumbing service - not electronics recycling',
      },
      { pattern: 'hvac', reason: 'HVAC service - not electronics recycling' },
    ];

    for (const entry of unscoredEntries) {
      const name_lower = entry.name?.toLowerCase() || '';

      for (const { pattern, reason } of problematic_patterns) {
        if (name_lower.includes(pattern)) {
          suspicious.push({
            id: entry.id,
            name: entry.name,
            city: entry.city,
            state: entry.state,
            pattern: pattern,
            reason: reason,
            confidence: 'high',
          });
          break; // Only flag once per entry
        }
      }
    }

    this.results.suspicious_patterns = suspicious;
    console.log(`   🚩 Found ${suspicious.length} clearly suspicious entries`);

    return suspicious;
  }

  async updateMissingScores(missingUpdates, dryRun = true) {
    if (missingUpdates.length === 0) {
      console.log('\n✅ No missing scores to update');
      return;
    }

    console.log(
      `\n${dryRun ? '🔍 DRY RUN:' : '💾'} Updating ${
        missingUpdates.length
      } missing legitimacy scores...`
    );

    let updated = 0;
    let errors = 0;

    for (const update of missingUpdates.slice(0, 10)) {
      // Limit for safety
      try {
        if (!dryRun) {
          const { error } = await supabase
            .from('recycling_centers')
            .update({
              legitimacy_score: update.scraped_score,
              legitimacy_reason: update.scraped_reason,
              is_legitimate: update.is_legitimate,
              is_suspicious: update.is_suspicious,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.id);

          if (error) {
            console.error(
              `   ❌ Error updating ${update.name}: ${error.message}`
            );
            errors++;
          } else {
            updated++;
          }
        }

        console.log(
          `   ${dryRun ? '🔍' : '✅'} ${update.name} (${update.city}, ${
            update.state
          }) - Score: ${update.scraped_score} (${update.source})`
        );
      } catch (error) {
        console.error(`   ❌ Error updating ${update.name}:`, error);
        errors++;
      }
    }

    if (!dryRun) {
      console.log(`\n📊 Update Results: ${updated} updated, ${errors} errors`);
    } else {
      console.log(
        `\n📊 Would update ${missingUpdates.length} entries (showing first 10)`
      );
    }
  }

  async generateReport() {
    console.log('\n📄 Generating missing scores investigation report...');

    const report = {
      investigation_date: new Date().toISOString(),
      database_analysis: {
        total_centers: this.results.unscored_in_db + 22341, // Approximate total
        unscored_entries: this.results.unscored_in_db,
        scored_entries: 22341, // Approximate
        unscored_percentage: (
          (this.results.unscored_in_db /
            (this.results.unscored_in_db + 22341)) *
          100
        ).toFixed(1),
      },
      data_files_analysis: {
        scraped_results_found: this.results.scraped_files_found,
        missing_updates_identified: this.results.missing_updates.length,
        potential_updates: this.results.potential_updates.length,
        suspicious_patterns: this.results.suspicious_patterns.length,
      },
      recommendations: [
        `Upload ${this.results.missing_updates.length} missing legitimacy scores from scraped data`,
        `Remove ${this.results.suspicious_patterns.length} clearly inappropriate entries`,
        `Investigate ${this.results.potential_updates.length} entries with scraped data but no scores`,
        'Consider rescrapingu remaining unscored entries with websites',
      ],
      missing_updates: this.results.missing_updates.slice(0, 100), // First 100 for review
      suspicious_entries: this.results.suspicious_patterns.slice(0, 50), // First 50 for review
    };

    await fs.writeFile(
      'missing-scores-investigation.json',
      JSON.stringify(report, null, 2)
    );
    console.log(`   💾 Report saved to: missing-scores-investigation.json`);

    return report;
  }

  async run() {
    try {
      console.log('🕵️ Starting Missing Legitimacy Scores Investigation...\n');

      // Step 1: Get unscored entries from database
      const unscoredEntries = await this.getUnscoredEntries();

      // Step 2: Load scraping results from files
      const scrapingResults = await this.loadScrapingResultsFiles();

      // Step 3: Find missing updates
      const { missingUpdates, potentialUpdates } =
        await this.findMissingUpdates(unscoredEntries, scrapingResults);

      // Step 4: Identify suspicious patterns
      const suspiciousPatterns = await this.identifySuspiciousPatterns(
        unscoredEntries
      );

      // Step 5: Show sample of what could be updated (dry run)
      await this.updateMissingScores(missingUpdates, true);

      // Step 6: Generate comprehensive report
      const report = await this.generateReport();

      console.log('\n🎯 INVESTIGATION SUMMARY:');
      console.log(
        `📊 Database: ${this.results.unscored_in_db} unscored entries`
      );
      console.log(
        `📁 Files: ${this.results.scraped_files_found} scraped results found`
      );
      console.log(
        `🔄 Ready to upload: ${missingUpdates.length} legitimacy scores`
      );
      console.log(
        `🚩 Suspicious entries: ${suspiciousPatterns.length} clearly inappropriate`
      );
      console.log(`📝 Report saved: missing-scores-investigation.json`);
    } catch (error) {
      console.error('❌ Investigation failed:', error);
      throw error;
    }
  }
}

async function main() {
  const investigator = new MissingScoresInvestigator();
  await investigator.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Investigation failed:', error);
    process.exit(1);
  });
}
