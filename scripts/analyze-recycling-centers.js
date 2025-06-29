#!/usr/bin/env node

/**
 * Recycling Centers Data Quality Analysis
 *
 * Analyzes all recycling centers to identify quality issues and potential duplicates
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

class RecyclingCenterAnalyzer {
  constructor() {
    this.allCenters = [];
    this.qualityIssues = {
      duplicates: [],
      missingData: [],
      lowTrustScore: [],
      badWebsites: [],
      suspiciousPhones: [],
      emptyDescriptions: [],
    };
    this.stats = {
      total: 0,
      processed: 0,
      cityCounts: new Map(),
      stateCounts: new Map(),
      trustScoreDistribution: {
        0: 0,
        '1-25': 0,
        '26-50': 0,
        '51-75': 0,
        '76-100': 0,
        '100+': 0,
      },
    };
  }

  async fetchAllCenters() {
    console.log('🔍 Fetching all recycling centers...');

    let allCenters = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: centers, error } = await supabase
        .from('recycling_centers')
        .select('*')
        .range(from, from + batchSize - 1);

      if (error) {
        throw new Error(`Error fetching centers: ${error.message}`);
      }

      if (centers && centers.length > 0) {
        allCenters = allCenters.concat(centers);
        from += batchSize;
        hasMore = centers.length === batchSize;
        console.log(
          `   Fetched ${centers.length} centers (total: ${allCenters.length})`
        );
      } else {
        hasMore = false;
      }
    }

    this.allCenters = allCenters;
    this.stats.total = allCenters.length;
    console.log(`✅ Loaded ${allCenters.length} recycling centers`);

    return allCenters;
  }

  analyzeDataQuality() {
    console.log('\n🔍 Analyzing data quality...');

    // Track seen combinations for duplicate detection
    const seenCombinations = new Map();
    const phoneNumbers = new Map();
    const websites = new Map();

    for (const center of this.allCenters) {
      this.stats.processed++;

      // Geographic distribution
      const cityState = `${center.city}, ${center.state}`;
      this.stats.cityCounts.set(
        cityState,
        (this.stats.cityCounts.get(cityState) || 0) + 1
      );
      this.stats.stateCounts.set(
        center.state,
        (this.stats.stateCounts.get(center.state) || 0) + 1
      );

      // Trust score distribution
      const trustScore = center.trust_score || 0;
      if (trustScore === 0) this.stats.trustScoreDistribution[0]++;
      else if (trustScore <= 25) this.stats.trustScoreDistribution['1-25']++;
      else if (trustScore <= 50) this.stats.trustScoreDistribution['26-50']++;
      else if (trustScore <= 75) this.stats.trustScoreDistribution['51-75']++;
      else if (trustScore <= 100) this.stats.trustScoreDistribution['76-100']++;
      else this.stats.trustScoreDistribution['100+']++;

      // 1. Check for duplicates by name + city + state
      const nameKey = `${center.name?.toLowerCase()}_${center.city?.toLowerCase()}_${center.state?.toLowerCase()}`;
      if (seenCombinations.has(nameKey)) {
        this.qualityIssues.duplicates.push({
          current: center,
          duplicate_of: seenCombinations.get(nameKey),
          reason: 'Same name + city + state',
        });
      } else {
        seenCombinations.set(nameKey, center);
      }

      // 2. Check for duplicate phone numbers
      if (center.phone) {
        const cleanPhone = center.phone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          if (phoneNumbers.has(cleanPhone)) {
            this.qualityIssues.duplicates.push({
              current: center,
              duplicate_of: phoneNumbers.get(cleanPhone),
              reason: 'Same phone number',
            });
          } else {
            phoneNumbers.set(cleanPhone, center);
          }
        }
      }

      // 3. Check for duplicate websites
      if (center.website) {
        const cleanWebsite = center.website
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '');
        if (websites.has(cleanWebsite)) {
          this.qualityIssues.duplicates.push({
            current: center,
            duplicate_of: websites.get(cleanWebsite),
            reason: 'Same website',
          });
        } else {
          websites.set(cleanWebsite, center);
        }
      }

      // 4. Check for missing critical data
      const missingFields = [];
      if (!center.name || center.name.trim() === '') missingFields.push('name');
      if (!center.city || center.city.trim() === '') missingFields.push('city');
      if (!center.state || center.state.trim() === '')
        missingFields.push('state');
      if (!center.address || center.address.trim() === '')
        missingFields.push('address');

      if (missingFields.length > 0) {
        this.qualityIssues.missingData.push({
          center: center,
          missing_fields: missingFields,
        });
      }

      // 5. Check for low trust scores
      if (trustScore < 20) {
        this.qualityIssues.lowTrustScore.push({
          center: center,
          trust_score: trustScore,
        });
      }

      // 6. Check for problematic websites
      if (center.website) {
        const website = center.website.toLowerCase();
        if (
          website.includes('facebook.com') ||
          website.includes('yelp.com') ||
          website.includes('yellowpages.com') ||
          website.includes('google.com') ||
          !website.includes('.')
        ) {
          this.qualityIssues.badWebsites.push({
            center: center,
            website: center.website,
            reason: 'Not a business website',
          });
        }
      }

      // 7. Check for suspicious phone numbers
      if (center.phone) {
        const phone = center.phone.replace(/\D/g, '');
        if (
          phone.length < 10 ||
          phone === '0000000000' ||
          phone === '1111111111' ||
          phone.match(/^(\d)\1{9}$/)
        ) {
          // All same digit
          this.qualityIssues.suspiciousPhones.push({
            center: center,
            phone: center.phone,
            reason: 'Invalid or fake phone number',
          });
        }
      }

      // 8. Check for empty descriptions
      if (
        !center.description ||
        center.description.trim() === '' ||
        center.description.length < 20
      ) {
        this.qualityIssues.emptyDescriptions.push({
          center: center,
          description_length: center.description?.length || 0,
        });
      }
    }

    console.log('✅ Data quality analysis complete');
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('RECYCLING CENTERS DATA QUALITY REPORT');
    console.log('='.repeat(80));

    // Overall statistics
    console.log('\n📊 OVERALL STATISTICS:');
    console.log(`Total centers: ${this.stats.total.toLocaleString()}`);
    console.log(`Processed: ${this.stats.processed.toLocaleString()}`);
    console.log(
      `Unique cities: ${this.stats.cityCounts.size.toLocaleString()}`
    );
    console.log(`States covered: ${this.stats.stateCounts.size}`);

    // Geographic distribution
    console.log('\n🌍 TOP 10 CITIES BY CENTER COUNT:');
    const topCities = Array.from(this.stats.cityCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    topCities.forEach(([city, count], index) => {
      console.log(`${index + 1}. ${city}: ${count.toLocaleString()} centers`);
    });

    console.log('\n🏛️ TOP 10 STATES BY CENTER COUNT:');
    const topStates = Array.from(this.stats.stateCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    topStates.forEach(([state, count], index) => {
      console.log(`${index + 1}. ${state}: ${count.toLocaleString()} centers`);
    });

    // Trust score distribution
    console.log('\n📈 TRUST SCORE DISTRIBUTION:');
    Object.entries(this.stats.trustScoreDistribution).forEach(
      ([range, count]) => {
        console.log(`${range}: ${count.toLocaleString()} centers`);
      }
    );

    // Quality issues
    console.log('\n🚨 QUALITY ISSUES FOUND:');
    console.log(
      `Potential duplicates: ${this.qualityIssues.duplicates.length.toLocaleString()}`
    );
    console.log(
      `Missing critical data: ${this.qualityIssues.missingData.length.toLocaleString()}`
    );
    console.log(
      `Low trust scores (<20): ${this.qualityIssues.lowTrustScore.length.toLocaleString()}`
    );
    console.log(
      `Bad websites: ${this.qualityIssues.badWebsites.length.toLocaleString()}`
    );
    console.log(
      `Suspicious phones: ${this.qualityIssues.suspiciousPhones.length.toLocaleString()}`
    );
    console.log(
      `Empty descriptions: ${this.qualityIssues.emptyDescriptions.length.toLocaleString()}`
    );

    // Detailed issue analysis
    if (this.qualityIssues.duplicates.length > 0) {
      console.log('\n🔍 DUPLICATE ANALYSIS:');
      const duplicateReasons = {};
      this.qualityIssues.duplicates.forEach((dup) => {
        duplicateReasons[dup.reason] = (duplicateReasons[dup.reason] || 0) + 1;
      });

      Object.entries(duplicateReasons).forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count} cases`);
      });

      console.log('\n📋 SAMPLE DUPLICATES:');
      this.qualityIssues.duplicates.slice(0, 5).forEach((dup, index) => {
        console.log(
          `${index + 1}. ${dup.current.name} (${dup.current.city}, ${
            dup.current.state
          })`
        );
        console.log(
          `   Duplicate of: ${dup.duplicate_of.name} (ID: ${dup.duplicate_of.id})`
        );
        console.log(`   Reason: ${dup.reason}\n`);
      });
    }

    // Cities with excessive centers (potential data quality issues)
    console.log('\n⚠️  CITIES WITH EXCESSIVE CENTERS (>50):');
    const excessiveCities = Array.from(this.stats.cityCounts.entries())
      .filter(([, count]) => count > 50)
      .sort(([, a], [, b]) => b - a);

    excessiveCities.forEach(([city, count]) => {
      console.log(`   ${city}: ${count} centers`);
    });

    // Calculate potential savings
    const totalDuplicates = this.qualityIssues.duplicates.length;
    const totalLowQuality =
      this.qualityIssues.lowTrustScore.length +
      this.qualityIssues.badWebsites.length +
      this.qualityIssues.suspiciousPhones.length;
    const totalRemovable = totalDuplicates + totalLowQuality;

    console.log('\n💡 CLEANUP RECOMMENDATIONS:');
    console.log(
      `Estimated removable centers: ${totalRemovable.toLocaleString()}`
    );
    console.log(
      `Potential database reduction: ${(
        (totalRemovable / this.stats.total) *
        100
      ).toFixed(1)}%`
    );
    console.log(
      `Remaining centers after cleanup: ${(
        this.stats.total - totalRemovable
      ).toLocaleString()}`
    );

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Review duplicate entries and remove obvious duplicates');
    console.log('2. Remove centers with trust scores < 10 and bad websites');
    console.log('3. Fix missing data where possible');
    console.log('4. Investigate cities with >100 centers for data quality');
    console.log('5. Consider removing centers with no phone AND no website');

    console.log('\n' + '='.repeat(80));
  }

  async exportProblematicCenters() {
    console.log('\n💾 Exporting problematic centers for review...');

    const fs = await import('fs').then((m) => m.promises);

    try {
      await fs.mkdir('./data', { recursive: true });

      // Export duplicates
      await fs.writeFile(
        './data/duplicate_centers.json',
        JSON.stringify(this.qualityIssues.duplicates, null, 2)
      );

      // Export low trust score centers
      await fs.writeFile(
        './data/low_trust_centers.json',
        JSON.stringify(this.qualityIssues.lowTrustScore, null, 2)
      );

      // Export summary for quick review
      const summary = {
        total_centers: this.stats.total,
        issues_found: {
          duplicates: this.qualityIssues.duplicates.length,
          missing_data: this.qualityIssues.missingData.length,
          low_trust: this.qualityIssues.lowTrustScore.length,
          bad_websites: this.qualityIssues.badWebsites.length,
          suspicious_phones: this.qualityIssues.suspiciousPhones.length,
          empty_descriptions: this.qualityIssues.emptyDescriptions.length,
        },
        top_cities: Array.from(this.stats.cityCounts.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20),
        trust_score_distribution: this.stats.trustScoreDistribution,
      };

      await fs.writeFile(
        './data/quality_analysis_summary.json',
        JSON.stringify(summary, null, 2)
      );

      console.log('✅ Exported analysis files to ./data/ directory');
    } catch (error) {
      console.error('❌ Failed to export files:', error.message);
    }
  }

  async run() {
    try {
      await this.fetchAllCenters();
      this.analyzeDataQuality();
      this.generateReport();
      await this.exportProblematicCenters();
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }
}

async function main() {
  const analyzer = new RecyclingCenterAnalyzer();
  await analyzer.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
}
