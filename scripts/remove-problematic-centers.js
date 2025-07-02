#!/usr/bin/env node

/**
 * Recycling Centers Removal Script
 *
 * This script safely removes problematic recycling centers based on the audit results.
 * It provides options to remove different categories of problematic entries with confirmation.
 *
 * IMPORTANT: Always run the audit script first and review the results before using this script!
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import readline from 'readline';

import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

class RecyclingCenterRemover {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.removedCount = 0;
    this.backupFile = `backup-before-removal-${
      new Date().toISOString().split('T')[0]
    }.json`;
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async run() {
    console.log('🗑️  Recycling Centers Removal Tool\n');
    console.log(
      '⚠️  WARNING: This will permanently delete entries from the database!'
    );
    console.log('⚠️  Make sure you have reviewed the audit results first.\n');

    const continueScript = await this.question(
      'Do you want to continue? (yes/no): '
    );
    if (continueScript.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled');
      this.rl.close();
      return;
    }

    await this.showRemovalOptions();
  }

  async showRemovalOptions() {
    console.log('\n📋 REMOVAL OPTIONS:');
    console.log('1. Remove illegitimate centers (is_legitimate = false)');
    console.log('2. Remove duplicate ecoATM entries (keep 1 per city)');
    console.log('3. Remove duplicate EZPAWN entries');
    console.log('4. Remove generic named centers with low scores');
    console.log('5. Remove non-electronics businesses');
    console.log('6. Remove centers with missing contact info');
    console.log('7. Custom removal from audit file');
    console.log('8. Exit');

    const choice = await this.question('\nSelect option (1-8): ');

    switch (choice) {
      case '1':
        await this.removeIllegitimateCenters();
        break;
      case '2':
        await this.removeDuplicateEcoATM();
        break;
      case '3':
        await this.removeEZPAWN();
        break;
      case '4':
        await this.removeGenericNames();
        break;
      case '5':
        await this.removeNonElectronics();
        break;
      case '6':
        await this.removeMissingContact();
        break;
      case '7':
        await this.removeFromAuditFile();
        break;
      case '8':
        console.log('👋 Exiting...');
        this.rl.close();
        return;
      default:
        console.log('❌ Invalid option');
        await this.showRemovalOptions();
        return;
    }

    // Show summary and ask if user wants to continue
    console.log(`\n✅ Removed ${this.removedCount} entries in this session`);
    const continueRemovals = await this.question(
      '\nDo you want to perform more removals? (yes/no): '
    );

    if (continueRemovals.toLowerCase() === 'yes') {
      this.removedCount = 0; // Reset counter for next operation
      await this.showRemovalOptions();
    } else {
      console.log('👋 Done!');
      this.rl.close();
    }
  }

  async removeIllegitimateCenters() {
    console.log('\n🔍 Finding illegitimate centers...');

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('id, name, city, state')
      .eq('is_legitimate', false);

    if (error) {
      console.error('❌ Error fetching illegitimate centers:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('✅ No illegitimate centers found');
      return;
    }

    console.log(`\n📊 Found ${data.length} illegitimate centers`);
    console.log('Sample entries:');
    data.slice(0, 5).forEach((center) => {
      console.log(`   - ${center.name} (${center.city}, ${center.state})`);
    });

    if (data.length > 5) {
      console.log(`   ... and ${data.length - 5} more`);
    }

    const confirm = await this.question(
      `\n❓ Remove all ${data.length} illegitimate centers? (yes/no): `
    );

    if (confirm.toLowerCase() === 'yes') {
      await this.createBackup(data, 'illegitimate');
      await this.performBatchRemoval(
        data.map((c) => c.id),
        'illegitimate centers'
      );
    }
  }

  async removeDuplicateEcoATM() {
    console.log('\n🔍 Finding TRUE duplicate ecoATM entries (same address)...');

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('id, name, city, state, full_address, legitimacy_score')
      .eq('name', 'ecoATM')
      .order('city, full_address');

    if (error) {
      console.error('❌ Error fetching ecoATM entries:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('✅ No ecoATM entries found');
      return;
    }

    // Group by address similarity to find TRUE duplicates
    const addressGroups = {};
    data.forEach((center) => {
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

    const toRemove = [];
    Object.values(addressGroups).forEach((group) => {
      if (group.length > 1) {
        // Sort by legitimacy score (desc) and keep the first one
        group.sort(
          (a, b) => (b.legitimacy_score || 0) - (a.legitimacy_score || 0)
        );
        toRemove.push(...group.slice(1)); // Add all except the first (best) one
      }
    });

    console.log(`\n📊 Found ${data.length} total ecoATM entries`);
    console.log(`📊 ${toRemove.length} TRUE duplicates found (same address)`);
    console.log(`📊 This preserves multiple legitimate locations per city`);

    if (toRemove.length === 0) {
      console.log(
        '✅ No address duplicates found - all ecoATM entries have unique addresses'
      );
      return;
    }

    // Show sample of what will be removed
    console.log('Sample address duplicates to remove:');
    toRemove.slice(0, 5).forEach((center) => {
      console.log(`   - ${center.name} (${center.city}, ${center.state})`);
      console.log(`     Address: ${center.full_address}`);
    });

    const confirm = await this.question(
      `\n❓ Remove ${toRemove.length} TRUE duplicate ecoATM entries? (yes/no): `
    );

    if (confirm.toLowerCase() === 'yes') {
      await this.createBackup(toRemove, 'duplicate_ecoATM');
      await this.performBatchRemoval(
        toRemove.map((c) => c.id),
        'duplicate ecoATM entries'
      );
    }
  }

  async removeEZPAWN() {
    console.log('\n🔍 Finding EZPAWN entries...');

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('id, name, city, state')
      .eq('name', 'EZPAWN');

    if (error) {
      console.error('❌ Error fetching EZPAWN entries:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('✅ No EZPAWN entries found');
      return;
    }

    console.log(`\n📊 Found ${data.length} EZPAWN entries`);
    console.log(
      'Note: EZPAWN locations are pawn shops, not electronics recycling centers'
    );

    const confirm = await this.question(
      `\n❓ Remove all ${data.length} EZPAWN entries? (yes/no): `
    );

    if (confirm.toLowerCase() === 'yes') {
      await this.createBackup(data, 'ezpawn');
      await this.performBatchRemoval(
        data.map((c) => c.id),
        'EZPAWN entries'
      );
    }
  }

  async removeGenericNames() {
    console.log('\n🔍 Finding generic named centers with low scores...');

    const genericPatterns = [
      'Recycling Center',
      'Recycling',
      'Waste Management',
    ];
    const allGeneric = [];

    for (const pattern of genericPatterns) {
      const { data, error } = await supabase
        .from('recycling_centers')
        .select('id, name, city, state, legitimacy_score')
        .eq('name', pattern)
        .lt('legitimacy_score', 35);

      if (!error && data) {
        allGeneric.push(...data);
      }
    }

    if (allGeneric.length === 0) {
      console.log('✅ No generic named centers with low scores found');
      return;
    }

    console.log(
      `\n📊 Found ${allGeneric.length} generic named centers with low legitimacy scores`
    );
    console.log('Sample entries:');
    allGeneric.slice(0, 5).forEach((center) => {
      console.log(
        `   - ${center.name} (${center.city}, ${center.state}) - Score: ${center.legitimacy_score}`
      );
    });

    const confirm = await this.question(
      `\n❓ Remove ${allGeneric.length} generic named centers? (yes/no): `
    );

    if (confirm.toLowerCase() === 'yes') {
      await this.createBackup(allGeneric, 'generic_names');
      await this.performBatchRemoval(
        allGeneric.map((c) => c.id),
        'generic named centers'
      );
    }
  }

  async removeNonElectronics() {
    console.log('\n🔍 Finding non-electronics businesses...');

    const patterns = ['%metal%', '%rubber%', '%tire%', '%auto%', '%scrap%'];
    const allNonElectronics = [];

    for (const pattern of patterns) {
      const { data, error } = await supabase
        .from('recycling_centers')
        .select('id, name, city, state, legitimacy_score')
        .ilike('name', pattern)
        .lt('legitimacy_score', 40);

      if (!error && data) {
        allNonElectronics.push(...data);
      }
    }

    if (allNonElectronics.length === 0) {
      console.log('✅ No non-electronics businesses found');
      return;
    }

    console.log(
      `\n📊 Found ${allNonElectronics.length} non-electronics businesses`
    );
    console.log('Sample entries:');
    allNonElectronics.slice(0, 5).forEach((center) => {
      console.log(`   - ${center.name} (${center.city}, ${center.state})`);
    });

    const confirm = await this.question(
      `\n❓ Remove ${allNonElectronics.length} non-electronics businesses? (yes/no): `
    );

    if (confirm.toLowerCase() === 'yes') {
      await this.createBackup(allNonElectronics, 'non_electronics');
      await this.performBatchRemoval(
        allNonElectronics.map((c) => c.id),
        'non-electronics businesses'
      );
    }
  }

  async removeMissingContact() {
    console.log(
      '\n🔍 Finding centers with missing contact info and low scores...'
    );

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('id, name, city, state, legitimacy_score')
      .is('phone', null)
      .is('site', null)
      .lt('legitimacy_score', 35);

    if (error) {
      console.error(
        '❌ Error fetching centers with missing contact info:',
        error
      );
      return;
    }

    if (!data || data.length === 0) {
      console.log(
        '✅ No centers with missing contact info and low scores found'
      );
      return;
    }

    console.log(
      `\n📊 Found ${data.length} centers with no phone, no website, and low legitimacy scores`
    );
    console.log('Sample entries:');
    data.slice(0, 5).forEach((center) => {
      console.log(
        `   - ${center.name} (${center.city}, ${center.state}) - Score: ${center.legitimacy_score}`
      );
    });

    const confirm = await this.question(
      `\n❓ Remove ${data.length} centers with missing contact info? (yes/no): `
    );

    if (confirm.toLowerCase() === 'yes') {
      await this.createBackup(data, 'missing_contact');
      await this.performBatchRemoval(
        data.map((c) => c.id),
        'centers with missing contact info'
      );
    }
  }

  async removeFromAuditFile() {
    console.log('\n📄 Looking for audit files...');

    const files = fs
      .readdirSync('.')
      .filter((f) => f.startsWith('audit-results-') && f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    if (files.length === 0) {
      console.log('❌ No audit files found. Run the audit script first.');
      return;
    }

    console.log('Available audit files:');
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });

    const fileChoice = await this.question(
      `\nSelect file (1-${files.length}): `
    );
    const selectedFile = files[parseInt(fileChoice) - 1];

    if (!selectedFile) {
      console.log('❌ Invalid file selection');
      return;
    }

    try {
      const auditData = JSON.parse(fs.readFileSync(selectedFile, 'utf8'));
      console.log(`\n📊 Audit file loaded: ${selectedFile}`);
      console.log(`Total problematic entries: ${auditData.totalProblematic}`);

      console.log('\nAvailable categories:');
      Object.entries(auditData.summary).forEach(([category, count], index) => {
        console.log(`${index + 1}. ${category}: ${count} entries`);
      });

      const categoryChoice = await this.question(
        '\nSelect category to remove (1-7): '
      );
      const categories = Object.keys(auditData.summary);
      const selectedCategory = categories[parseInt(categoryChoice) - 1];

      if (!selectedCategory) {
        console.log('❌ Invalid category selection');
        return;
      }

      const entries = auditData.categories[selectedCategory];
      if (!entries || entries.length === 0) {
        console.log('✅ No entries in selected category');
        return;
      }

      console.log(
        `\n📊 Selected: ${selectedCategory} (${entries.length} entries)`
      );
      const confirm = await this.question(
        `\n❓ Remove all ${entries.length} entries from ${selectedCategory}? (yes/no): `
      );

      if (confirm.toLowerCase() === 'yes') {
        await this.createBackup(entries, selectedCategory);
        await this.performBatchRemoval(
          entries.map((e) => e.id),
          `${selectedCategory} entries`
        );
      }
    } catch (error) {
      console.error('❌ Error reading audit file:', error);
    }
  }

  async createBackup(data, category) {
    const backupData = {
      timestamp: new Date().toISOString(),
      category: category,
      count: data.length,
      entries: data,
    };

    const filename = `backup-${category}-${
      new Date().toISOString().split('T')[0]
    }.json`;
    fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
    console.log(`💾 Backup saved to: ${filename}`);
  }

  async performBatchRemoval(ids, description) {
    console.log(`\n🗑️  Removing ${ids.length} ${description}...`);

    const batchSize = 100; // Remove in batches to avoid timeouts
    let removedInBatch = 0;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);

      const { error } = await supabase
        .from('recycling_centers')
        .delete()
        .in('id', batch);

      if (error) {
        console.error(`❌ Error removing batch ${i / batchSize + 1}:`, error);
        continue;
      }

      removedInBatch += batch.length;
      console.log(
        `   ✅ Removed batch ${Math.floor(i / batchSize) + 1}: ${
          batch.length
        } entries`
      );
    }

    this.removedCount += removedInBatch;
    console.log(`\n✅ Successfully removed ${removedInBatch} ${description}`);
  }
}

// Run the removal tool
async function main() {
  const remover = new RecyclingCenterRemover();
  await remover.run();
}

main().catch(console.error);
