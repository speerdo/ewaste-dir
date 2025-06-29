#!/usr/bin/env node

/**
 * Recycling Centers Database Cleanup
 *
 * Systematically removes duplicates and fixes data quality issues
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

class DatabaseCleaner {
  constructor() {
    this.stats = {
      totalCenters: 0,
      duplicatesRemoved: 0,
      lowQualityRemoved: 0,
      addressesFixed: 0,
      chainStoresEnhanced: 0,
      trustScoresCalculated: 0,
    };
    this.dryRun = true; // Set to false to actually make changes
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

        if (from % 5000 === 0) {
          console.log(`   Fetched ${allCenters.length} centers...`);
        }
      } else {
        hasMore = false;
      }
    }

    this.stats.totalCenters = allCenters.length;
    console.log(`✅ Loaded ${allCenters.length} recycling centers`);

    return allCenters;
  }

  async removeDuplicates(centers) {
    console.log('\n🔧 Phase 1: Removing Duplicates...');

    const seenCombinations = new Map();
    const phoneNumbers = new Map();
    const toDelete = [];

    // First pass: identify exact duplicates (same name + city + state)
    for (const center of centers) {
      const nameKey = `${center.name?.toLowerCase()}_${center.city?.toLowerCase()}_${center.state?.toLowerCase()}`;

      if (seenCombinations.has(nameKey)) {
        const existing = seenCombinations.get(nameKey);

        // Keep the one with better data quality (more fields filled)
        const existingScore = this.scoreDataQuality(existing);
        const currentScore = this.scoreDataQuality(center);

        if (currentScore <= existingScore) {
          toDelete.push(center.id);
        } else {
          // Replace the existing one with this better one
          toDelete.push(existing.id);
          seenCombinations.set(nameKey, center);
        }
      } else {
        seenCombinations.set(nameKey, center);
      }
    }

    // Second pass: identify phone number duplicates (but keep if different businesses)
    const remainingCenters = centers.filter((c) => !toDelete.includes(c.id));

    for (const center of remainingCenters) {
      if (center.phone) {
        const cleanPhone = center.phone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          if (phoneNumbers.has(cleanPhone)) {
            const existing = phoneNumbers.get(cleanPhone);

            // Only mark as duplicate if same business type or chain
            if (this.isSameBusiness(center, existing)) {
              const existingScore = this.scoreDataQuality(existing);
              const currentScore = this.scoreDataQuality(center);

              if (currentScore <= existingScore) {
                toDelete.push(center.id);
              } else {
                toDelete.push(existing.id);
                phoneNumbers.set(cleanPhone, center);
              }
            }
          } else {
            phoneNumbers.set(cleanPhone, center);
          }
        }
      }
    }

    console.log(`📋 Found ${toDelete.length} duplicates to remove`);

    if (this.dryRun) {
      console.log(
        '🔍 DRY RUN: Would delete these duplicates (showing first 10):'
      );
      const samples = toDelete.slice(0, 10);
      for (const id of samples) {
        const center = centers.find((c) => c.id === id);
        console.log(`   - ${center?.name} (${center?.city}, ${center?.state})`);
      }
    } else {
      // Actually delete duplicates in batches
      const batchSize = 100;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);

        const { error } = await supabase
          .from('recycling_centers')
          .delete()
          .in('id', batch);

        if (error) {
          console.error(`❌ Error deleting batch: ${error.message}`);
        } else {
          console.log(`✅ Deleted batch of ${batch.length} duplicates`);
        }
      }
    }

    this.stats.duplicatesRemoved = toDelete.length;
    return toDelete;
  }

  scoreDataQuality(center) {
    let score = 0;

    if (center.name && center.name.trim()) score += 1;
    if (center.address && center.address.trim()) score += 2;
    if (center.phone && center.phone.trim()) score += 1;
    if (
      center.website &&
      center.website.trim() &&
      !center.website.includes('facebook.com')
    )
      score += 2;
    if (
      center.description &&
      center.description.trim() &&
      center.description.length > 20
    )
      score += 1;
    if (center.hours && center.hours.trim()) score += 1;

    return score;
  }

  isSameBusiness(center1, center2) {
    // Check if they're the same chain store at the same location
    const chains = [
      'ecoATM',
      'Best Buy',
      'Staples',
      'Office Depot',
      'Walmart',
      'Target',
      'ShredTronics',
    ];

    for (const chain of chains) {
      if (center1.name?.includes(chain) && center2.name?.includes(chain)) {
        // Same chain - check if same location (city + similar address)
        if (
          center1.city?.toLowerCase() === center2.city?.toLowerCase() &&
          center1.state?.toLowerCase() === center2.state?.toLowerCase()
        ) {
          // If both have addresses, check similarity
          if (center1.address && center2.address) {
            const addressSimilarity = this.calculateSimilarity(
              center1.address,
              center2.address
            );
            return addressSimilarity > 0.6; // Same store if addresses are 60%+ similar
          }

          // If no addresses to compare, assume same store in same city for chains
          return true;
        }

        // Different cities = different stores, keep both
        return false;
      }
    }

    // Check if names are very similar (>90% match) and same location
    if (
      center1.city?.toLowerCase() === center2.city?.toLowerCase() &&
      center1.state?.toLowerCase() === center2.state?.toLowerCase()
    ) {
      const similarity = this.calculateSimilarity(
        center1.name || '',
        center2.name || ''
      );
      return similarity > 0.9;
    }

    return false;
  }

  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1;

    // Simple Levenshtein distance approximation
    const distance = this.levenshteinDistance(
      str1.toLowerCase(),
      str2.toLowerCase()
    );
    return (maxLen - distance) / maxLen;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  async removeLowQualityCenters(centers) {
    console.log('\n🔧 Phase 2: Removing Low Quality Centers...');

    const toDelete = [];
    const chains = [
      'ecoATM',
      'Best Buy',
      'Staples',
      'Office Depot',
      'Walmart',
      'Target',
      'ShredTronics',
    ];

    for (const center of centers) {
      let shouldRemove = false;
      const reasons = [];

      // Check if this is a known chain store
      const isChainStore = chains.some((chain) => center.name?.includes(chain));

      // More lenient rules for chain stores
      if (isChainStore) {
        // Only remove chain stores if they have obviously fake data
        if (center.phone) {
          const phone = center.phone.replace(/\D/g, '');
          if (
            phone === '0000000000' ||
            phone === '1111111111' ||
            phone.match(/^(\d)\1{9}$/)
          ) {
            shouldRemove = true;
            reasons.push('Fake phone number');
          }
        }

        // Keep chain stores even with minimal data - they're legitimate businesses
      } else {
        // Stricter rules for non-chain stores

        // Remove if no contact info AND no website
        if (
          (!center.phone || center.phone.trim() === '') &&
          (!center.website || center.website.trim() === '')
        ) {
          shouldRemove = true;
          reasons.push('No contact info');
        }

        // Remove if obviously fake phone
        if (center.phone) {
          const phone = center.phone.replace(/\D/g, '');
          if (
            phone === '0000000000' ||
            phone === '1111111111' ||
            phone.match(/^(\d)\1{9}$/)
          ) {
            shouldRemove = true;
            reasons.push('Fake phone number');
          }
        }

        // Remove if name is too generic or empty
        if (!center.name || center.name.trim().length < 3) {
          shouldRemove = true;
          reasons.push('No valid name');
        }

        // Remove if website is just social media
        if (center.website) {
          const website = center.website.toLowerCase();
          if (
            website.includes('facebook.com') &&
            (!center.phone || center.phone.trim() === '')
          ) {
            shouldRemove = true;
            reasons.push('Only Facebook, no phone');
          }
        }
      }

      if (shouldRemove) {
        toDelete.push({
          id: center.id,
          name: center.name,
          city: center.city,
          state: center.state,
          reasons: reasons,
          isChain: isChainStore,
        });
      }
    }

    console.log(`📋 Found ${toDelete.length} low-quality centers to remove`);

    if (this.dryRun) {
      console.log(
        '🔍 DRY RUN: Would delete these low-quality centers (showing first 10):'
      );
      toDelete.slice(0, 10).forEach((center, index) => {
        console.log(
          `   ${index + 1}. ${center.name} (${center.city}, ${center.state})`
        );
        console.log(`      Reasons: ${center.reasons.join(', ')}`);
      });
    } else {
      // Actually delete in batches
      const batchSize = 100;
      const ids = toDelete.map((c) => c.id);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);

        const { error } = await supabase
          .from('recycling_centers')
          .delete()
          .in('id', batch);

        if (error) {
          console.error(`❌ Error deleting batch: ${error.message}`);
        } else {
          console.log(
            `✅ Deleted batch of ${batch.length} low-quality centers`
          );
        }
      }
    }

    this.stats.lowQualityRemoved = toDelete.length;
    return toDelete.map((c) => c.id);
  }

  async enhanceChainStoreData(centers) {
    console.log('\n🔧 Phase 3: Enhancing Chain Store Data...');

    const chains = [
      'ecoATM',
      'Best Buy',
      'Staples',
      'Office Depot',
      'Walmart',
      'Target',
      'ShredTronics',
    ];
    const chainStores = centers.filter((center) =>
      chains.some((chain) => center.name?.includes(chain))
    );

    console.log(
      `📋 Found ${chainStores.length} chain store entries to enhance`
    );

    const enhancements = {
      'Best Buy': {
        website:
          'https://www.bestbuy.com/site/services/recycling/pcmcat149900050025.c',
        description:
          'Electronics retailer offering free recycling for many electronic devices including TVs, computers, phones, and small appliances.',
        hours: 'Store hours vary by location',
        services: ['TVs', 'Computers', 'Phones', 'Tablets', 'Small Appliances'],
      },
      ecoATM: {
        website: 'https://www.ecoatm.com',
        description:
          'Automated kiosks that buy back used mobile devices including phones and tablets for cash or store credit.',
        hours: '24/7 (kiosk availability)',
        services: ['Mobile Phones', 'Tablets'],
      },
      Staples: {
        website: 'https://www.staples.com/sbd/cre/programs/recycling-services/',
        description:
          'Office supply retailer offering free electronics recycling for computers, monitors, printers and other office electronics.',
        hours: 'Store hours vary by location',
        services: [
          'Computers',
          'Monitors',
          'Printers',
          'Ink Cartridges',
          'Batteries',
        ],
      },
      'Office Depot': {
        website: 'https://www.officedepot.com/a/content/env-tech-recycling/',
        description:
          'Office supply store providing free recycling services for various electronics and office equipment.',
        hours: 'Store hours vary by location',
        services: [
          'Computers',
          'Monitors',
          'Printers',
          'Ink Cartridges',
          'Batteries',
        ],
      },
      Walmart: {
        website: 'https://corporate.walmart.com/newsroom/sustainability/waste',
        description:
          'Retail chain offering electronics recycling services including phones, tablets, and some computer equipment.',
        hours: 'Store hours vary by location',
        services: ['Mobile Phones', 'Tablets', 'Ink Cartridges', 'Batteries'],
      },
      Target: {
        website:
          'https://help.target.com/help/subcategoryarticle?childcat=Electronics+recycling',
        description:
          'Retail store providing recycling for electronics including phones, ink cartridges, and small electronics.',
        hours: 'Store hours vary by location',
        services: [
          'Mobile Phones',
          'Ink Cartridges',
          'Batteries',
          'Small Electronics',
        ],
      },
      ShredTronics: {
        website: 'https://www.shredtronics.com',
        description:
          'Professional document destruction and electronics recycling service for businesses and individuals.',
        hours: 'Business hours vary by location',
        services: [
          'Hard Drives',
          'Computers',
          'Servers',
          'Media Devices',
          'Document Destruction',
        ],
      },
    };

    let enhanced = 0;

    if (this.dryRun) {
      console.log(
        '🔍 DRY RUN: Would enhance chain store data (showing first 5):'
      );
      chainStores.slice(0, 5).forEach((center, index) => {
        const chainName = chains.find((chain) => center.name?.includes(chain));
        console.log(
          `   ${index + 1}. ${center.name} (${center.city}, ${center.state})`
        );
        if (chainName && enhancements[chainName]) {
          console.log(
            `      Would add: ${enhancements[chainName].description.substring(
              0,
              80
            )}...`
          );
        }
      });
    } else {
      // Actually enhance the data
      const batchSize = 50;

      for (let i = 0; i < chainStores.length; i += batchSize) {
        const batch = chainStores.slice(i, i + batchSize);

        for (const center of batch) {
          const chainName = chains.find((chain) =>
            center.name?.includes(chain)
          );

          if (chainName && enhancements[chainName]) {
            const enhancement = enhancements[chainName];
            const updates = {};

            // Only update if current data is missing or poor quality
            if (!center.website || center.website.includes('facebook.com')) {
              updates.website = enhancement.website;
            }

            if (!center.description || center.description.length < 50) {
              updates.description = enhancement.description;
            }

            if (!center.hours || center.hours.trim() === '') {
              updates.hours = enhancement.hours;
            }

            // Always update trust score for chain stores
            updates.trust_score = 85; // High trust score for known chains
            updates.updated_at = new Date().toISOString();

            if (Object.keys(updates).length > 0) {
              const { error } = await supabase
                .from('recycling_centers')
                .update(updates)
                .eq('id', center.id);

              if (error) {
                console.error(
                  `❌ Error updating ${center.name}: ${error.message}`
                );
              } else {
                enhanced++;
              }
            }
          }
        }

        console.log(`✅ Enhanced batch of ${batch.length} chain stores`);
      }
    }

    this.stats.chainStoresEnhanced = enhanced;
    return enhanced;
  }

  async fixMissingAddresses(centers) {
    console.log('\n🔧 Phase 4: Fixing Missing Addresses...');

    const toFix = centers.filter(
      (center) => !center.address || center.address.trim() === ''
    );

    console.log(`📋 Found ${toFix.length} centers missing addresses`);

    let fixed = 0;

    if (this.dryRun) {
      console.log(
        '🔍 DRY RUN: Would attempt to fix addresses for these centers (showing first 5):'
      );
      toFix.slice(0, 5).forEach((center, index) => {
        console.log(
          `   ${index + 1}. ${center.name} (${center.city}, ${center.state})`
        );
      });
    } else {
      // For now, just set a placeholder address based on city/state
      const batchSize = 100;

      for (let i = 0; i < toFix.length; i += batchSize) {
        const batch = toFix.slice(i, i + batchSize);

        for (const center of batch) {
          const placeholderAddress = `${center.city}, ${center.state}`;

          const { error } = await supabase
            .from('recycling_centers')
            .update({ address: placeholderAddress })
            .eq('id', center.id);

          if (error) {
            console.error(
              `❌ Error updating address for ${center.name}: ${error.message}`
            );
          } else {
            fixed++;
          }
        }

        console.log(`✅ Fixed addresses for batch of ${batch.length} centers`);
      }
    }

    this.stats.addressesFixed = fixed;
    return fixed;
  }

  async generateSummaryReport() {
    const startCount = this.stats.totalCenters;
    const endCount =
      startCount - this.stats.duplicatesRemoved - this.stats.lowQualityRemoved;
    const reduction =
      ((this.stats.duplicatesRemoved + this.stats.lowQualityRemoved) /
        startCount) *
      100;

    console.log('\n' + '='.repeat(80));
    console.log('DATABASE CLEANUP SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n📊 BEFORE CLEANUP:`);
    console.log(`Total centers: ${startCount.toLocaleString()}`);

    console.log(`\n🧹 ACTIONS TAKEN:`);
    console.log(
      `Duplicates removed: ${this.stats.duplicatesRemoved.toLocaleString()}`
    );
    console.log(
      `Low-quality removed: ${this.stats.lowQualityRemoved.toLocaleString()}`
    );
    console.log(
      `Chain stores enhanced: ${this.stats.chainStoresEnhanced.toLocaleString()}`
    );
    console.log(
      `Addresses fixed: ${this.stats.addressesFixed.toLocaleString()}`
    );

    console.log(`\n📊 AFTER CLEANUP:`);
    console.log(`Remaining centers: ${endCount.toLocaleString()}`);
    console.log(`Database reduction: ${reduction.toFixed(1)}%`);
    console.log(
      `Quality improvement: Significant data quality issues resolved`
    );

    if (this.dryRun) {
      console.log(`\n⚠️  THIS WAS A DRY RUN - NO ACTUAL CHANGES MADE`);
      console.log(`To apply changes, set dryRun = false in the script`);
    }

    console.log('\n🎯 RECOMMENDED NEXT STEPS:');
    console.log('1. Fix trust score calculation algorithm');
    console.log('2. Implement better address validation/geocoding');
    console.log('3. Add business verification process');
    console.log('4. Set up duplicate prevention for future data imports');

    console.log('\n' + '='.repeat(80));
  }

  async run() {
    try {
      console.log(`🚀 Starting database cleanup (DRY RUN: ${this.dryRun})...`);

      const centers = await this.fetchAllCenters();

      await this.removeDuplicates(centers);

      const remainingCenters = centers; // In dry run, we don't actually remove them
      await this.removeLowQualityCenters(remainingCenters);

      await this.enhanceChainStoreData(remainingCenters);

      await this.fixMissingAddresses(remainingCenters);

      await this.generateSummaryReport();
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }
}

async function main() {
  const cleaner = new DatabaseCleaner();
  await cleaner.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Database cleanup failed:', error);
    process.exit(1);
  });
}
