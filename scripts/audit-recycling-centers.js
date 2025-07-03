#!/usr/bin/env node

/**
 * Recycling Centers Database Audit Script
 *
 * This script identifies recycling centers that are most likely to be irrelevant,
 * incorrect, or low-quality entries that should be considered for removal.
 *
 * Based on analysis of 31,875 total centers, we found several categories of problematic entries:
 * - 65 illegitimate centers (is_legitimate = false)
 * - 5,110 low legitimacy centers (score < 50)
 * - Massive duplicates (ecoATM, EZPAWN locations)
 * - Generic/vague business names
 * - Non-electronics focused businesses
 * - Missing critical contact information
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

class RecyclingCenterAuditor {
  constructor() {
    this.problemCategories = {
      illegitimate: [],
      lowLegitimacy: [],
      duplicates: [],
      genericNames: [],
      nonElectronics: [],
      missingContact: [],
      suspiciousBusinessTypes: [],
    };
    this.totalProblematic = 0;
  }

  async runAudit() {
    console.log('🔍 Starting Recycling Centers Database Audit...\n');

    await this.findIllegitimateCenters();
    await this.findLowLegitimacyCenters();
    await this.findDuplicates();
    await this.findGenericNames();
    await this.findNonElectronicsBusinesses();
    await this.findMissingContactInfo();
    await this.findSuspiciousBusinessTypes();

    this.generateReport();
    await this.saveResultsToFile();
  }

  async findIllegitimateCenters() {
    console.log('📍 Finding centers marked as illegitimate...');

    const { data, error } = await supabase
      .from('recycling_centers')
      .select(
        'id, name, city, state, phone, site, full_address, legitimacy_score, legitimacy_reason'
      )
      .eq('is_legitimate', false)
      .order('legitimacy_score');

    if (error) {
      console.error('Error fetching illegitimate centers:', error);
      return;
    }

    this.problemCategories.illegitimate = data || [];
    console.log(
      `   Found ${this.problemCategories.illegitimate.length} illegitimate centers`
    );
  }

  async findLowLegitimacyCenters() {
    console.log('📍 Finding centers with low legitimacy scores...');

    const { data, error } = await supabase
      .from('recycling_centers')
      .select(
        'id, name, city, state, phone, site, full_address, legitimacy_score, legitimacy_reason'
      )
      .lt('legitimacy_score', 35)
      .neq('is_legitimate', false) // Don't double-count illegitimate ones
      .order('legitimacy_score')
      .limit(100); // Limit to worst 100

    if (error) {
      console.error('Error fetching low legitimacy centers:', error);
      return;
    }

    this.problemCategories.lowLegitimacy = data || [];
    console.log(
      `   Found ${this.problemCategories.lowLegitimacy.length} centers with very low legitimacy scores`
    );
  }

  async findDuplicates() {
    console.log('📍 Finding duplicate entries...');

    // Find ecoATM duplicates based on address similarity, not just city
    const { data: ecoATMData, error: ecoError } = await supabase
      .from('recycling_centers')
      .select('id, name, city, state, full_address, legitimacy_score')
      .eq('name', 'ecoATM')
      .order('city, full_address');

    // Find EZPAWN duplicates
    const { data: ezPawnDupes, error: ezError } = await supabase
      .from('recycling_centers')
      .select('id, name, city, state, full_address, legitimacy_score')
      .eq('name', 'EZPAWN')
      .order('legitimacy_score');

    if (ecoError || ezError) {
      console.error('Error fetching duplicates:', ecoError || ezError);
      return;
    }

    // Group ecoATM by address similarity to find TRUE duplicates
    const addressGroups = {};
    (ecoATMData || []).forEach((center) => {
      if (!center.full_address) return;

      // Normalize address for comparison
      const normalizedAddress = center.full_address
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();

      const key = `${center.city}_${center.state}_${normalizedAddress}`;
      if (!addressGroups[key]) addressGroups[key] = [];
      addressGroups[key].push(center);
    });

    // Find actual address duplicates
    const trueDuplicates = [];
    Object.values(addressGroups).forEach((group) => {
      if (group.length > 1) {
        // Sort by legitimacy score (desc) and keep the first one
        group.sort(
          (a, b) => (b.legitimacy_score || 0) - (a.legitimacy_score || 0)
        );
        trueDuplicates.push(...group.slice(1)); // Add all except the first (best) one
      }
    });

    // Also look for very similar addresses (potential data entry variations)
    const addressSimilarityGroups = {};
    (ecoATMData || []).forEach((center) => {
      if (!center.full_address) return;

      // Create a simplified key for detecting similar addresses
      const simpleAddress = center.full_address
        .toLowerCase()
        .replace(/[^\w]/g, '') // Remove all non-alphanumeric
        .replace(
          /(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane)/,
          ''
        ) // Remove street suffixes
        .slice(0, 20); // Take first 20 chars

      const key = `${center.city}_${center.state}_${simpleAddress}`;
      if (!addressSimilarityGroups[key]) addressSimilarityGroups[key] = [];
      addressSimilarityGroups[key].push(center);
    });

    // Find similar address duplicates
    Object.values(addressSimilarityGroups).forEach((group) => {
      if (group.length > 1) {
        // Check if addresses are actually very similar (manual review candidates)
        const addresses = group.map((c) => c.full_address);
        const allSimilar = addresses.every((addr1) =>
          addresses.some(
            (addr2) =>
              addr1 !== addr2 && this.addressSimilarity(addr1, addr2) > 0.8
          )
        );

        if (allSimilar) {
          group.sort(
            (a, b) => (b.legitimacy_score || 0) - (a.legitimacy_score || 0)
          );
          // Only add if not already in trueDuplicates
          const newDupes = group
            .slice(1)
            .filter(
              (item) => !trueDuplicates.some((dup) => dup.id === item.id)
            );
          trueDuplicates.push(...newDupes);
        }
      }
    });

    // Add all EZPAWN entries (they're pawn shops, not recycling centers)
    this.problemCategories.duplicates.push(...(ezPawnDupes || []));
    this.problemCategories.duplicates.push(...trueDuplicates);

    console.log(
      `   Found ${trueDuplicates.length} true ecoATM address duplicates to remove`
    );
    console.log(
      `   Found ${
        (ezPawnDupes || []).length
      } EZPAWN entries (pawn shops) to remove`
    );
    console.log(
      `   Total duplicates: ${this.problemCategories.duplicates.length}`
    );
  }

  // Helper function to calculate address similarity
  addressSimilarity(addr1, addr2) {
    if (!addr1 || !addr2) return 0;

    const normalize = (str) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const a1 = normalize(addr1);
    const a2 = normalize(addr2);

    // Simple string similarity check
    const longer = a1.length > a2.length ? a1 : a2;
    const shorter = a1.length > a2.length ? a2 : a1;

    if (longer.length === 0) return 1.0;

    const matches = shorter
      .split('')
      .filter((char, i) => char === longer[i]).length;
    return matches / longer.length;
  }

  async findGenericNames() {
    console.log('📍 Finding centers with generic names...');

    const genericPatterns = [
      'Recycling Center',
      'Recycling',
      'Waste Management',
      'Transfer Station',
      'Landfill',
      'Waste Services',
    ];

    for (const pattern of genericPatterns) {
      const { data, error } = await supabase
        .from('recycling_centers')
        .select(
          'id, name, city, state, phone, site, full_address, legitimacy_score, legitimacy_reason'
        )
        .eq('name', pattern)
        .lt('legitimacy_score', 50)
        .order('legitimacy_score')
        .limit(20);

      if (!error && data) {
        this.problemCategories.genericNames.push(...data);
      }
    }

    console.log(
      `   Found ${this.problemCategories.genericNames.length} centers with generic names and low scores`
    );
  }

  async findNonElectronicsBusinesses() {
    console.log('📍 Finding non-electronics businesses...');

    const nonElectronicsPatterns = [
      '%metal%',
      '%rubber%',
      '%tire%',
      '%auto%',
      '%scrap%',
      '%junk%',
    ];

    for (const pattern of nonElectronicsPatterns) {
      const { data, error } = await supabase
        .from('recycling_centers')
        .select(
          'id, name, city, state, phone, site, full_address, legitimacy_score, legitimacy_reason'
        )
        .ilike('name', pattern)
        .lt('legitimacy_score', 40)
        .order('legitimacy_score')
        .limit(10);

      if (!error && data) {
        this.problemCategories.nonElectronics.push(...data);
      }
    }

    console.log(
      `   Found ${this.problemCategories.nonElectronics.length} non-electronics businesses`
    );
  }

  async findMissingContactInfo() {
    console.log('📍 Finding centers with missing contact information...');

    const { data, error } = await supabase
      .from('recycling_centers')
      .select(
        'id, name, city, state, phone, site, full_address, legitimacy_score, legitimacy_reason'
      )
      .is('phone', null)
      .is('site', null)
      .lt('legitimacy_score', 40)
      .order('legitimacy_score')
      .limit(50);

    if (error) {
      console.error('Error fetching centers with missing contact info:', error);
      return;
    }

    this.problemCategories.missingContact = data || [];
    console.log(
      `   Found ${this.problemCategories.missingContact.length} centers with no phone AND no website`
    );
  }

  async findSuspiciousBusinessTypes() {
    console.log('📍 Finding suspicious business types...');

    const suspiciousPatterns = [
      '%grocery%',
      '%restaurant%',
      '%hotel%',
      '%gas station%',
      '%funeral%',
      '%bank%',
    ];

    for (const pattern of suspiciousPatterns) {
      const { data, error } = await supabase
        .from('recycling_centers')
        .select(
          'id, name, city, state, phone, site, full_address, legitimacy_score, legitimacy_reason'
        )
        .ilike('name', pattern)
        .order('legitimacy_score')
        .limit(10);

      if (!error && data) {
        this.problemCategories.suspiciousBusinessTypes.push(...data);
      }
    }

    console.log(
      `   Found ${this.problemCategories.suspiciousBusinessTypes.length} suspicious business types`
    );
  }

  generateReport() {
    console.log('\n📊 AUDIT RESULTS SUMMARY');
    console.log('========================\n');

    this.totalProblematic = Object.values(this.problemCategories).reduce(
      (sum, category) => sum + category.length,
      0
    );

    console.log(`🔴 TOTAL PROBLEMATIC ENTRIES: ${this.totalProblematic}\n`);

    console.log('📈 BREAKDOWN BY CATEGORY:');
    console.log('--------------------------');
    console.log(
      `💀 Illegitimate Centers: ${this.problemCategories.illegitimate.length}`
    );
    console.log(
      `📉 Low Legitimacy (<35): ${this.problemCategories.lowLegitimacy.length}`
    );
    console.log(
      `👥 Duplicate Entries: ${this.problemCategories.duplicates.length}`
    );
    console.log(
      `🏷️  Generic Names: ${this.problemCategories.genericNames.length}`
    );
    console.log(
      `🚫 Non-Electronics: ${this.problemCategories.nonElectronics.length}`
    );
    console.log(
      `📞 Missing Contact: ${this.problemCategories.missingContact.length}`
    );
    console.log(
      `❓ Suspicious Types: ${this.problemCategories.suspiciousBusinessTypes.length}`
    );

    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('-------------------');
    console.log(
      '1. START with illegitimate centers (immediate removal candidates)'
    );
    console.log('2. REMOVE duplicate ecoATM/EZPAWN entries (keep 1 per city)');
    console.log('3. REVIEW generic named centers with low scores');
    console.log('4. EVALUATE non-electronics businesses for relevance');
    console.log('5. CHECK missing contact info centers manually');

    console.log('\n💡 IMPACT ESTIMATE:');
    console.log('-------------------');
    const totalCenters = 31875;
    const removalPercentage = (
      (this.totalProblematic / totalCenters) *
      100
    ).toFixed(1);
    console.log(
      `Removing these ${this.totalProblematic} entries would clean up ${removalPercentage}% of the database`
    );
    console.log(`Remaining centers: ${totalCenters - this.totalProblematic}`);
  }

  async saveResultsToFile() {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `audit-results-${timestamp}.json`;

    const results = {
      auditDate: new Date().toISOString(),
      totalProblematic: this.totalProblematic,
      categories: this.problemCategories,
      summary: {
        illegitimate: this.problemCategories.illegitimate.length,
        lowLegitimacy: this.problemCategories.lowLegitimacy.length,
        duplicates: this.problemCategories.duplicates.length,
        genericNames: this.problemCategories.genericNames.length,
        nonElectronics: this.problemCategories.nonElectronics.length,
        missingContact: this.problemCategories.missingContact.length,
        suspiciousBusinessTypes:
          this.problemCategories.suspiciousBusinessTypes.length,
      },
    };

    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${filename}`);
    console.log(
      '📄 You can review the detailed entries and create removal scripts from this file.'
    );
  }
}

// Run the audit
async function main() {
  const auditor = new RecyclingCenterAuditor();
  await auditor.runAudit();
}

main().catch(console.error);
