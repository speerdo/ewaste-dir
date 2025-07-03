# Recycling Centers Database Audit

## Overview

This directory contains tools for auditing and cleaning up the recycling centers database. After analyzing the 31,875 recycling centers, we identified several categories of problematic entries that should be considered for removal.

## 🔍 Audit Findings

### Summary Statistics

- **Total centers**: 31,875
- **Illegitimate centers**: 65 (marked as `is_legitimate = false`)
- **Low legitimacy centers**: 5,110 (score < 50) - about 16% of database
- **Missing phone numbers**: 1,201 centers
- **Missing websites**: 4,767 centers
- **Missing addresses**: 1 center

### 🚨 Major Issues Identified

#### 1. Massive Duplicates

- **ecoATM**: 38 duplicates in San Antonio alone, 32 in Houston, 25 in Indianapolis
- **EZPAWN**: 19 duplicates in Houston (pawn shops, not recycling centers)
- **Total duplicate problem**: Hundreds of duplicate entries

#### 2. Generic/Vague Business Names

- "Recycling Center" (multiple entries with identical names)
- "Recycling"
- "Waste Management"
- "Transfer Station"

#### 3. Non-Electronics Businesses

- Metal recyclers: "Mid Cape Metal Recyclers", "Texas Disposal Systems Metal Buying"
- Rubber recyclers: "C M Rubber Recycling"
- Auto recyclers: "Auto Recycling of Montgomery"
- Scrap yards: "L&m scrapyard"
- Junk removal services

#### 4. Irrelevant Business Types

- Grocery stores (bottle return centers)
- Electronics repair shops (not recycling)
- Pawn shops (EZPAWN entries)
- Gas stations, bars, hotels, banks (incorrectly categorized)

#### 5. Missing Critical Information

- Centers with no phone AND no website AND low legitimacy scores
- Entries with incomplete or suspicious contact information

## 🛠️ Tools

### 1. Audit Script (`audit-recycling-centers.js`)

**Purpose**: Identifies problematic entries and generates a comprehensive report.

**Usage**:

```bash
node scripts/audit-recycling-centers.js
```

**Output**:

- Console report with summary statistics
- JSON file (`audit-results-YYYY-MM-DD.json`) with detailed entries

**What it finds**:

- Centers marked as illegitimate
- Centers with very low legitimacy scores (<35)
- Duplicate ecoATM/EZPAWN entries
- Generic named centers with low scores
- Non-electronics businesses
- Centers with missing contact info
- Suspicious business types

### 2. Removal Script (`remove-problematic-centers.js`)

**Purpose**: Safely removes problematic entries with user confirmation and backup.

**Usage**:

```bash
node scripts/remove-problematic-centers.js
```

**Features**:

- Interactive menu for different removal categories
- Automatic backup before deletion
- Batch processing to avoid timeouts
- Confirmation prompts for safety
- Can work from audit file results

**Safety Features**:

- Creates backup files before any deletion
- Requires explicit confirmation for each operation
- Shows samples of what will be removed
- Processes in batches to handle large removals

## 📊 Recommended Cleanup Strategy

### Phase 1: Immediate Removals (High Confidence)

1. **Illegitimate centers** (65 entries) - Already marked as false
2. **EZPAWN entries** (~19 entries) - Pawn shops, not recycling centers
3. **Duplicate ecoATM entries** (keep 1 per city, remove hundreds of others)

**Estimated impact**: Remove ~200-300 entries

### Phase 2: Low Legitimacy Score Cleanup

1. **Generic names with scores <35** - Very low quality entries
2. **Non-electronics businesses** - Metal/rubber/auto recyclers
3. **Missing contact info** - No phone, no website, low score

**Estimated impact**: Remove ~150-200 entries

### Phase 3: Manual Review (Optional)

1. Review remaining centers with scores 35-50
2. Spot-check suspicious business types
3. Verify centers with unusual names

## 🚀 Quick Start

1. **Run the audit** to see current state:

   ```bash
   node scripts/audit-recycling-centers.js
   ```

2. **Review the results** in the generated JSON file

3. **Start with safest removals**:

   ```bash
   node scripts/remove-problematic-centers.js
   # Choose option 1 (illegitimate centers)
   # Choose option 3 (EZPAWN entries)
   # Choose option 2 (duplicate ecoATM entries)
   ```

4. **Verify results** by running audit again

## 💾 Backup Strategy

The removal script automatically creates backups:

- `backup-{category}-YYYY-MM-DD.json` - Before each removal operation
- Backups include full entry data for restoration if needed

## ⚠️ Important Notes

- **Test on staging first** if available
- **Review audit results** before running removals
- **Keep backup files** for at least 30 days
- **Monitor website functionality** after bulk removals
- **Consider gradual removal** rather than all at once

## 🔄 Expected Outcome

After completing the recommended cleanup:

- Remove 300-500 problematic entries (1-2% of database)
- Improve overall data quality
- Reduce irrelevant search results
- Better user experience with more relevant recycling centers
- Maintain ~31,400-31,600 high-quality centers

## 📈 Impact Assessment

The cleanup will:

- ✅ Remove clearly irrelevant businesses
- ✅ Eliminate duplicate entries that confuse users
- ✅ Improve search result relevance
- ✅ Maintain comprehensive coverage for legitimate centers
- ✅ Reduce database size by 1-2% while improving quality significantly
