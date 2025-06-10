import fs from 'fs/promises';
import path from 'path';

const CONFIG = {
  PLACES_RESEARCH_DIR: './data/places_research',
  SCRAPED_DATA_DIR: './data/scraped_data',
  OUTPUT_DIR: './data',
  MINIMUM_DESCRIPTION_LENGTH: 10,
  MAXIMUM_DESCRIPTION_LENGTH: 1000,
  REQUIRED_PLACES_FIELDS: [
    'centerId',
    'centerName',
    'city',
    'state',
    'success',
    'searchedAt',
  ],
  REQUIRED_RETRY_FIELDS: [
    'centerId',
    'centerName',
    'url',
    'city',
    'state',
    'success',
    'scrapedAt',
  ],
  SUSPICIOUS_INDICATORS: [
    'casino',
    'gambling',
    'tobacco',
    'smoke',
    'vape',
    'alcohol',
    'liquor',
    'bar',
    'nightclub',
  ],
};

class DataQualityChecker {
  constructor() {
    this.issues = {
      duplicates: [],
      missingFields: [],
      invalidData: [],
      dataIntegrity: [],
      businessLogic: [],
      anomalies: [],
    };

    this.stats = {
      placesData: {
        totalFiles: 0,
        totalRecords: 0,
        uniqueCenters: 0,
        successfulLookups: 0,
        failedLookups: 0,
      },
      retryData: {
        totalFiles: 0,
        totalRecords: 0,
        uniqueCenters: 0,
        successfulRetries: 0,
        failedRetries: 0,
      },
      qualityMetrics: {
        dataCompleteness: 0,
        dataAccuracy: 0,
        dataConsistency: 0,
        businessLogicCompliance: 0,
      },
    };

    this.placesData = new Map();
    this.retryData = new Map();
  }

  async loadPlacesData() {
    console.log('\n📊 LOADING GOOGLE PLACES RESEARCH DATA');
    console.log('=====================================');

    try {
      const files = await fs.readdir(CONFIG.PLACES_RESEARCH_DIR);
      const placesFiles = files.filter(
        (f) => f.startsWith('places_research_') && f.endsWith('.json')
      );

      this.stats.placesData.totalFiles = placesFiles.length;
      console.log(`Found ${placesFiles.length} Google Places research files`);

      for (const file of placesFiles) {
        const filePath = path.join(CONFIG.PLACES_RESEARCH_DIR, file);
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const records = JSON.parse(data);

          console.log(`  📄 ${file}: ${records.length} records`);

          for (const record of records) {
            this.processPlacesRecord(record, file);
          }

          this.stats.placesData.totalRecords += records.length;
        } catch (error) {
          console.warn(`  ⚠️  Could not parse ${file}: ${error.message}`);
          this.issues.invalidData.push({
            type: 'file_parse_error',
            file,
            error: error.message,
          });
        }
      }

      this.stats.placesData.uniqueCenters = this.placesData.size;
      console.log(
        `Loaded ${this.stats.placesData.totalRecords} total places records`
      );
      console.log(
        `Found ${this.stats.placesData.uniqueCenters} unique centers`
      );
    } catch (error) {
      console.error(`❌ Error loading places data: ${error.message}`);
    }
  }

  async loadRetryData() {
    console.log('\n📊 LOADING RETRY DATA');
    console.log('====================');

    try {
      const files = await fs.readdir(CONFIG.SCRAPED_DATA_DIR);

      // Prioritize cleaned retry files
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

      this.stats.retryData.totalFiles = retryFiles.length;
      console.log(`Found ${cleanedRetryFiles.length} cleaned retry files`);
      console.log(
        `Found ${individualRetryFiles.length} individual retry files`
      );
      console.log(
        `Using ${retryFiles.length} retry files (prioritizing cleaned)`
      );

      for (const file of retryFiles) {
        const filePath = path.join(CONFIG.SCRAPED_DATA_DIR, file);
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const records = JSON.parse(data);

          console.log(`  📄 ${file}: ${records.length} records`);

          for (const record of records) {
            this.processRetryRecord(record, file);
          }

          this.stats.retryData.totalRecords += records.length;
        } catch (error) {
          console.warn(`  ⚠️  Could not parse ${file}: ${error.message}`);
          this.issues.invalidData.push({
            type: 'file_parse_error',
            file,
            error: error.message,
          });
        }
      }

      this.stats.retryData.uniqueCenters = this.retryData.size;
      console.log(
        `Loaded ${this.stats.retryData.totalRecords} total retry records`
      );
      console.log(`Found ${this.stats.retryData.uniqueCenters} unique centers`);
    } catch (error) {
      console.error(`❌ Error loading retry data: ${error.message}`);
    }
  }

  processPlacesRecord(record, fileName) {
    const centerId = record.centerId;

    // Check for required fields
    this.validateRequiredFields(
      record,
      CONFIG.REQUIRED_PLACES_FIELDS,
      fileName,
      'places'
    );

    // Check for duplicates
    if (this.placesData.has(centerId)) {
      const existing = this.placesData.get(centerId);
      this.issues.duplicates.push({
        type: 'places_duplicate',
        centerId,
        centerName: record.centerName,
        files: [existing.fileName, fileName],
        timestamps: [existing.record.searchedAt, record.searchedAt],
      });

      // Keep the more recent record
      if (new Date(record.searchedAt) > new Date(existing.record.searchedAt)) {
        this.placesData.set(centerId, { record, fileName });
      }
    } else {
      this.placesData.set(centerId, { record, fileName });
    }

    // Track success/failure
    if (record.success) {
      this.stats.placesData.successfulLookups++;
    } else {
      this.stats.placesData.failedLookups++;
    }

    // Validate data integrity
    this.validatePlacesDataIntegrity(record, fileName);
  }

  processRetryRecord(record, fileName) {
    const centerId = record.centerId;

    // Check for required fields
    this.validateRequiredFields(
      record,
      CONFIG.REQUIRED_RETRY_FIELDS,
      fileName,
      'retry'
    );

    // Check for duplicates
    if (this.retryData.has(centerId)) {
      const existing = this.retryData.get(centerId);
      this.issues.duplicates.push({
        type: 'retry_duplicate',
        centerId,
        centerName: record.centerName,
        files: [existing.fileName, fileName],
        timestamps: [existing.record.scrapedAt, record.scrapedAt],
      });

      // Keep successful retry over failed, or more recent if same status
      if (record.success && !existing.record.success) {
        this.retryData.set(centerId, { record, fileName });
      } else if (record.success === existing.record.success) {
        if (new Date(record.scrapedAt) > new Date(existing.record.scrapedAt)) {
          this.retryData.set(centerId, { record, fileName });
        }
      }
    } else {
      this.retryData.set(centerId, { record, fileName });
    }

    // Track success/failure
    if (record.success) {
      this.stats.retryData.successfulRetries++;
    } else {
      this.stats.retryData.failedRetries++;
    }

    // Validate data integrity
    this.validateRetryDataIntegrity(record, fileName);
  }

  validateRequiredFields(record, requiredFields, fileName, dataType) {
    for (const field of requiredFields) {
      if (!record[field] && record[field] !== 0 && record[field] !== false) {
        this.issues.missingFields.push({
          type: `missing_${field}`,
          dataType,
          centerId: record.centerId,
          centerName: record.centerName,
          fileName,
          field,
        });
      }
    }
  }

  validatePlacesDataIntegrity(record, fileName) {
    // Check searchedAt timestamp
    if (record.searchedAt && isNaN(new Date(record.searchedAt))) {
      this.issues.invalidData.push({
        type: 'invalid_timestamp',
        dataType: 'places',
        centerId: record.centerId,
        fileName,
        field: 'searchedAt',
        value: record.searchedAt,
      });
    }

    // Check confidence score range
    if (
      record.confidence !== undefined &&
      (record.confidence < 0 || record.confidence > 100)
    ) {
      this.issues.invalidData.push({
        type: 'invalid_confidence_range',
        dataType: 'places',
        centerId: record.centerId,
        fileName,
        value: record.confidence,
      });
    }

    // Check legitimacy score consistency
    if (record.legitimacyScore !== undefined) {
      const isLegitimate = record.legitimacyScore >= 30;
      const isSuspicious = record.legitimacyScore < -10;

      if (
        record.isLegitimate !== isLegitimate ||
        record.isSuspicious !== isSuspicious
      ) {
        this.issues.businessLogic.push({
          type: 'legitimacy_logic_inconsistency',
          centerId: record.centerId,
          fileName,
          legitimacyScore: record.legitimacyScore,
          isLegitimate: record.isLegitimate,
          isSuspicious: record.isSuspicious,
          expectedLegitimate: isLegitimate,
          expectedSuspicious: isSuspicious,
        });
      }
    }

    // Check website matching logic
    if (record.existingWebsite && record.website) {
      const shouldMatch =
        this.normalizeUrl(record.existingWebsite) ===
        this.normalizeUrl(record.website);
      if (record.websiteMatches !== shouldMatch) {
        this.issues.businessLogic.push({
          type: 'website_matching_inconsistency',
          centerId: record.centerId,
          fileName,
          existingWebsite: record.existingWebsite,
          foundWebsite: record.website,
          reportedMatch: record.websiteMatches,
          expectedMatch: shouldMatch,
        });
      }
    }

    // Check for suspicious business indicators
    this.checkSuspiciousIndicators(record, fileName, 'places');
  }

  validateRetryDataIntegrity(record, fileName) {
    // Check scrapedAt timestamp
    if (record.scrapedAt && isNaN(new Date(record.scrapedAt))) {
      this.issues.invalidData.push({
        type: 'invalid_timestamp',
        dataType: 'retry',
        centerId: record.centerId,
        fileName,
        field: 'scrapedAt',
        value: record.scrapedAt,
      });
    }

    // Check URL validity
    if (record.url) {
      try {
        new URL(record.url);
      } catch (error) {
        this.issues.invalidData.push({
          type: 'invalid_url',
          dataType: 'retry',
          centerId: record.centerId,
          fileName,
          url: record.url,
          error: error.message,
        });
      }
    }

    // Check description length
    if (record.suggestedDescription) {
      const length = record.suggestedDescription.length;
      if (length < CONFIG.MINIMUM_DESCRIPTION_LENGTH) {
        this.issues.dataIntegrity.push({
          type: 'description_too_short',
          centerId: record.centerId,
          fileName,
          length,
          minimum: CONFIG.MINIMUM_DESCRIPTION_LENGTH,
        });
      } else if (length > CONFIG.MAXIMUM_DESCRIPTION_LENGTH) {
        this.issues.dataIntegrity.push({
          type: 'description_too_long',
          centerId: record.centerId,
          fileName,
          length,
          maximum: CONFIG.MAXIMUM_DESCRIPTION_LENGTH,
        });
      }
    }

    // Check for suspicious business indicators
    this.checkSuspiciousIndicators(record, fileName, 'retry');
  }

  checkSuspiciousIndicators(record, fileName, dataType) {
    const searchText = `${record.centerName} ${record.title || ''} ${
      record.content || ''
    } ${record.metaDescription || ''}`.toLowerCase();

    for (const indicator of CONFIG.SUSPICIOUS_INDICATORS) {
      if (searchText.includes(indicator)) {
        this.issues.anomalies.push({
          type: 'suspicious_business_indicator',
          dataType,
          centerId: record.centerId,
          centerName: record.centerName,
          fileName,
          indicator,
          context: this.extractContext(searchText, indicator),
        });
      }
    }
  }

  extractContext(text, keyword, contextLength = 50) {
    const index = text.indexOf(keyword);
    if (index === -1) return '';

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + keyword.length + contextLength);

    return text.substring(start, end).trim();
  }

  normalizeUrl(url) {
    if (!url) return '';
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }

  async crossValidateData() {
    console.log('\n🔍 CROSS-VALIDATING PLACES AND RETRY DATA');
    console.log('==========================================');

    // Find centers that appear in both datasets
    const commonCenters = [];
    const placesOnlyCenters = [];
    const retryOnlyCenters = [];

    for (const centerId of this.placesData.keys()) {
      if (this.retryData.has(centerId)) {
        commonCenters.push(centerId);
      } else {
        placesOnlyCenters.push(centerId);
      }
    }

    for (const centerId of this.retryData.keys()) {
      if (!this.placesData.has(centerId)) {
        retryOnlyCenters.push(centerId);
      }
    }

    console.log(`Centers in both datasets: ${commonCenters.length}`);
    console.log(`Centers only in places data: ${placesOnlyCenters.length}`);
    console.log(`Centers only in retry data: ${retryOnlyCenters.length}`);

    // Cross-validate common centers
    for (const centerId of commonCenters) {
      const placesRecord = this.placesData.get(centerId).record;
      const retryRecord = this.retryData.get(centerId).record;

      // Check name consistency
      if (placesRecord.centerName !== retryRecord.centerName) {
        this.issues.dataIntegrity.push({
          type: 'name_mismatch_between_datasets',
          centerId,
          placesName: placesRecord.centerName,
          retryName: retryRecord.centerName,
        });
      }

      // Check location consistency
      if (
        placesRecord.city !== retryRecord.city ||
        placesRecord.state !== retryRecord.state
      ) {
        this.issues.dataIntegrity.push({
          type: 'location_mismatch_between_datasets',
          centerId,
          placesLocation: `${placesRecord.city}, ${placesRecord.state}`,
          retryLocation: `${retryRecord.city}, ${retryRecord.state}`,
        });
      }

      // Check website consistency
      if (placesRecord.website && retryRecord.url) {
        const placesUrl = this.normalizeUrl(placesRecord.website);
        const retryUrl = this.normalizeUrl(retryRecord.url);

        if (placesUrl !== retryUrl) {
          this.issues.dataIntegrity.push({
            type: 'website_mismatch_between_datasets',
            centerId,
            placesWebsite: placesRecord.website,
            retryWebsite: retryRecord.url,
          });
        }
      }
    }
  }

  calculateQualityMetrics() {
    const totalRecords =
      this.stats.placesData.totalRecords + this.stats.retryData.totalRecords;
    const totalIssues = Object.values(this.issues).reduce(
      (sum, issues) => sum + issues.length,
      0
    );

    // Data Completeness (% of records without missing required fields)
    const missingFieldIssues = this.issues.missingFields.length;
    this.stats.qualityMetrics.dataCompleteness =
      totalRecords > 0
        ? ((totalRecords - missingFieldIssues) / totalRecords) * 100
        : 100;

    // Data Accuracy (% of records without invalid data)
    const invalidDataIssues = this.issues.invalidData.length;
    this.stats.qualityMetrics.dataAccuracy =
      totalRecords > 0
        ? ((totalRecords - invalidDataIssues) / totalRecords) * 100
        : 100;

    // Data Consistency (% of records without integrity issues)
    const integrityIssues = this.issues.dataIntegrity.length;
    this.stats.qualityMetrics.dataConsistency =
      totalRecords > 0
        ? ((totalRecords - integrityIssues) / totalRecords) * 100
        : 100;

    // Business Logic Compliance (% of records without business logic violations)
    const businessLogicIssues = this.issues.businessLogic.length;
    this.stats.qualityMetrics.businessLogicCompliance =
      totalRecords > 0
        ? ((totalRecords - businessLogicIssues) / totalRecords) * 100
        : 100;
  }

  generateQualityReport() {
    console.log('\n📋 DATA QUALITY REPORT');
    console.log('======================');

    // Overview statistics
    console.log('\n📊 OVERVIEW STATISTICS');
    console.log('----------------------');
    console.log(`Google Places Data:`);
    console.log(`  Files: ${this.stats.placesData.totalFiles}`);
    console.log(`  Records: ${this.stats.placesData.totalRecords}`);
    console.log(`  Unique Centers: ${this.stats.placesData.uniqueCenters}`);
    console.log(
      `  Success Rate: ${(
        (this.stats.placesData.successfulLookups /
          this.stats.placesData.totalRecords) *
        100
      ).toFixed(1)}%`
    );

    console.log(`\nRetry Data:`);
    console.log(`  Files: ${this.stats.retryData.totalFiles}`);
    console.log(`  Records: ${this.stats.retryData.totalRecords}`);
    console.log(`  Unique Centers: ${this.stats.retryData.uniqueCenters}`);
    console.log(
      `  Success Rate: ${(
        (this.stats.retryData.successfulRetries /
          this.stats.retryData.totalRecords) *
        100
      ).toFixed(1)}%`
    );

    // Quality metrics
    console.log('\n🎯 QUALITY METRICS');
    console.log('------------------');
    console.log(
      `Data Completeness: ${this.stats.qualityMetrics.dataCompleteness.toFixed(
        1
      )}%`
    );
    console.log(
      `Data Accuracy: ${this.stats.qualityMetrics.dataAccuracy.toFixed(1)}%`
    );
    console.log(
      `Data Consistency: ${this.stats.qualityMetrics.dataConsistency.toFixed(
        1
      )}%`
    );
    console.log(
      `Business Logic Compliance: ${this.stats.qualityMetrics.businessLogicCompliance.toFixed(
        1
      )}%`
    );

    // Issue summary
    console.log('\n🚨 ISSUES SUMMARY');
    console.log('-----------------');
    console.log(`Duplicates: ${this.issues.duplicates.length}`);
    console.log(`Missing Fields: ${this.issues.missingFields.length}`);
    console.log(`Invalid Data: ${this.issues.invalidData.length}`);
    console.log(`Data Integrity: ${this.issues.dataIntegrity.length}`);
    console.log(`Business Logic: ${this.issues.businessLogic.length}`);
    console.log(`Anomalies: ${this.issues.anomalies.length}`);

    // Detailed issue reporting
    if (this.issues.duplicates.length > 0) {
      console.log(`\n⚠️  DUPLICATES (${this.issues.duplicates.length} found):`);
      this.issues.duplicates.slice(0, 5).forEach((issue) => {
        console.log(`  ${issue.type}: ${issue.centerName} (${issue.centerId})`);
        console.log(`    Files: ${issue.files.join(', ')}`);
      });
      if (this.issues.duplicates.length > 5) {
        console.log(`    ... and ${this.issues.duplicates.length - 5} more`);
      }
    }

    if (this.issues.missingFields.length > 0) {
      console.log(
        `\n⚠️  MISSING FIELDS (${this.issues.missingFields.length} found):`
      );
      const fieldCounts = {};
      this.issues.missingFields.forEach((issue) => {
        fieldCounts[issue.field] = (fieldCounts[issue.field] || 0) + 1;
      });
      Object.entries(fieldCounts).forEach(([field, count]) => {
        console.log(`  ${field}: ${count} records`);
      });
    }

    if (this.issues.anomalies.length > 0) {
      console.log(`\n🔍 ANOMALIES (${this.issues.anomalies.length} found):`);
      this.issues.anomalies.slice(0, 5).forEach((issue) => {
        if (issue.type === 'suspicious_business_indicator') {
          console.log(
            `  Suspicious indicator "${issue.indicator}" in: ${issue.centerName}`
          );
          console.log(`    Context: "${issue.context}"`);
        }
      });
      if (this.issues.anomalies.length > 5) {
        console.log(`    ... and ${this.issues.anomalies.length - 5} more`);
      }
    }
  }

  async generateDetailedReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const report = {
      generatedAt: new Date().toISOString(),
      statistics: this.stats,
      qualityMetrics: this.stats.qualityMetrics,
      issues: this.issues,
      summary: {
        totalRecords:
          this.stats.placesData.totalRecords +
          this.stats.retryData.totalRecords,
        totalUniqueRecords:
          this.stats.placesData.uniqueCenters +
          this.stats.retryData.uniqueCenters,
        totalIssues: Object.values(this.issues).reduce(
          (sum, issues) => sum + issues.length,
          0
        ),
        overallQualityScore: (
          (this.stats.qualityMetrics.dataCompleteness +
            this.stats.qualityMetrics.dataAccuracy +
            this.stats.qualityMetrics.dataConsistency +
            this.stats.qualityMetrics.businessLogicCompliance) /
          4
        ).toFixed(1),
      },
    };

    // Save detailed JSON report
    const reportPath = path.join(
      CONFIG.OUTPUT_DIR,
      `data_quality_report_${timestamp}.json`
    );
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate CSV for high-priority issues
    if (
      this.issues.duplicates.length > 0 ||
      this.issues.dataIntegrity.length > 0
    ) {
      const csvIssues = [
        ...this.issues.duplicates.map((issue) => ({
          priority: 'High',
          type: 'Duplicate',
          centerId: issue.centerId,
          centerName: issue.centerName,
          description: `Duplicate found in files: ${issue.files.join(', ')}`,
          recommendation: 'Remove duplicate records, keep most recent',
        })),
        ...this.issues.dataIntegrity.slice(0, 100).map((issue) => ({
          priority: 'Medium',
          type: 'Data Integrity',
          centerId: issue.centerId,
          centerName: issue.centerName || 'Unknown',
          description: issue.type,
          recommendation: 'Manual review required',
        })),
      ];

      const csvHeader =
        'Priority,Type,Center ID,Center Name,Description,Recommendation\n';
      const csvRows = csvIssues
        .map(
          (issue) =>
            `"${issue.priority}","${issue.type}","${issue.centerId}","${issue.centerName}","${issue.description}","${issue.recommendation}"`
        )
        .join('\n');

      const csvPath = path.join(
        CONFIG.OUTPUT_DIR,
        `data_quality_issues_${timestamp}.csv`
      );
      await fs.writeFile(csvPath, csvHeader + csvRows);

      console.log(`\n💾 Generated detailed reports:`);
      console.log(`  JSON: ${reportPath}`);
      console.log(`  CSV:  ${csvPath}`);
    }

    return report;
  }

  async run() {
    console.log('🔍 DATA QUALITY CHECKER');
    console.log('========================');
    console.log(
      'Comprehensive quality analysis for Google Places and retry data\n'
    );

    // Load all data
    await this.loadPlacesData();
    await this.loadRetryData();

    // Cross-validate data between sources
    await this.crossValidateData();

    // Calculate quality metrics
    this.calculateQualityMetrics();

    // Generate reports
    this.generateQualityReport();
    const detailedReport = await this.generateDetailedReport();

    console.log('\n🎉 QUALITY CHECK COMPLETE!');
    console.log('===========================');
    console.log(
      `Overall Quality Score: ${detailedReport.summary.overallQualityScore}%`
    );

    // Recommendations
    if (detailedReport.summary.overallQualityScore < 95) {
      console.log('\n💡 RECOMMENDATIONS:');
      if (this.issues.duplicates.length > 0) {
        console.log('  1. Run deduplication on your data files');
      }
      if (this.issues.missingFields.length > 0) {
        console.log('  2. Review and fix missing required fields');
      }
      if (this.issues.dataIntegrity.length > 0) {
        console.log('  3. Investigate data integrity issues');
      }
      if (this.issues.anomalies.length > 0) {
        console.log('  4. Review flagged anomalies for potential data issues');
      }
    } else {
      console.log('\n✅ Data quality is excellent! No major issues found.');
    }

    return detailedReport;
  }
}

// Run the data quality checker
const checker = new DataQualityChecker();
checker.run().catch(console.error);
