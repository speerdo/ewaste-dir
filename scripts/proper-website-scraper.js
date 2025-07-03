import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Electronics recycling keywords (from original scraper)
const RECYCLING_KEYWORDS = [
  'electronics recycling',
  'e-waste',
  'electronic waste',
  'computer recycling',
  'laptop recycling',
  'phone recycling',
  'tablet recycling',
  'tv recycling',
  'monitor recycling',
  'printer recycling',
  'battery recycling',
  'cell phone recycling',
  'recycle electronics',
  'recycle computers',
  'recycle laptops',
  'recycle phones',
  'electronics disposal',
  'electronic disposal',
  'e-waste disposal',
  'trade in',
  'trade-in',
  'buyback',
  'buy back',
  'drop off',
  'drop-off',
  'r2 certified',
  'e-stewards',
  'iso 14001',
  'data destruction',
  'hard drive destruction',
  'certified recycler',
  'electronics refurbishing',
  'refurbish electronics',
];

// Red flag keywords (businesses unlikely to offer electronics recycling)
const RED_FLAG_KEYWORDS = [
  'restaurant',
  'food',
  'pizza',
  'burger',
  'cafe',
  'diner',
  'grill',
  'bakery',
  'medical',
  'health',
  'hospital',
  'clinic',
  'pharmacy',
  'dental',
  'doctor',
  'automotive',
  'car',
  'vehicle',
  'auto repair',
  'tire',
  'oil change',
  'real estate',
  'property',
  'mortgage',
  'insurance',
  'financial',
  'bank',
  'clothing',
  'fashion',
  'apparel',
  'shoes',
  'jewelry',
  'beauty',
  'salon',
];

const CONFIG = {
  BATCH_SIZE: 10,
  MAX_CONCURRENT: 3,
  DELAY_BETWEEN_REQUESTS: 2000,
  MAX_RETRIES: 2,
  TIMEOUT: 25000,
  MAX_ENTRIES_TO_PROCESS: null, // Process ALL remaining entries
};

class ProperWebsiteScraper {
  constructor() {
    this.browser = null;
    this.progress = {
      processed: 0,
      total: 0,
      scored: 0,
      failed: 0,
      errors: [],
    };
  }

  async initialize() {
    console.log('🚀 Initializing browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
      ],
    });
  }

  async getUnscoredWithWebsites() {
    console.log('📋 Fetching unscored entries with websites...');

    let allCenters = [];
    let page = 0;
    const pageSize = 1000;

    while (
      !CONFIG.MAX_ENTRIES_TO_PROCESS ||
      allCenters.length < CONFIG.MAX_ENTRIES_TO_PROCESS
    ) {
      const { data: centers, error } = await supabase
        .from('recycling_centers')
        .select('id, name, site, city, state, full_address')
        .is('legitimacy_score', null)
        .not('site', 'is', null)
        .neq('site', '')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      if (!centers || centers.length === 0) break;

      allCenters.push(...centers);
      console.log(
        `Fetched page ${page + 1}: ${centers.length} entries (total: ${
          allCenters.length
        })`
      );

      if (centers.length < pageSize) break;
      page++;
    }

    // Limit to max entries for this run (if specified)
    const finalCenters = CONFIG.MAX_ENTRIES_TO_PROCESS
      ? allCenters.slice(0, CONFIG.MAX_ENTRIES_TO_PROCESS)
      : allCenters;

    console.log(
      `📊 Processing ${finalCenters.length} unscored entries with websites\n`
    );

    this.progress.total = finalCenters.length;
    return finalCenters;
  }

  async scrapeWebsite(url, center) {
    let page = null;
    let pageIsClosed = false;

    try {
      // Clean up the URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      page = await this.browser.newPage();

      // Set user agent and viewport
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.TIMEOUT,
      });

      // Wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Extract content
      const content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach((el) => el.remove());

        return document.body.innerText || document.body.textContent || '';
      });

      // Extract title and meta description
      const title = await page.title();
      const metaDescription = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="description"]');
        return meta ? meta.getAttribute('content') : '';
      });

      // Get contact information
      const contactInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        const phoneRegex = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

        return {
          phones: [...new Set(text.match(phoneRegex) || [])],
          emails: [...new Set(text.match(emailRegex) || [])],
        };
      });

      await page.close();
      pageIsClosed = true;

      return {
        success: true,
        title,
        metaDescription,
        content: content.substring(0, 5000), // Limit content length
        contactInfo,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);

      if (!pageIsClosed && page) {
        try {
          await page.close();
        } catch (closeError) {
          console.log(`⚠️ Could not close page: ${closeError.message}`);
        }
      }

      return {
        success: false,
        error: error.message,
        scrapedAt: new Date().toISOString(),
      };
    }
  }

  analyzeBusinessForElectronicsRecycling(scrapedData, center) {
    const allText =
      `${scrapedData.title} ${scrapedData.metaDescription} ${scrapedData.content}`.toLowerCase();

    // Count electronics/recycling-related keywords
    const recyclingScore = RECYCLING_KEYWORDS.reduce((score, keyword) => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      return score + matches;
    }, 0);

    // Count red flag keywords (businesses unlikely to offer electronics recycling)
    const redFlagScore = RED_FLAG_KEYWORDS.reduce((score, keyword) => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      return score + matches;
    }, 0);

    // Calculate legitimacy score - FOCUSED ON ELECTRONICS RECYCLING
    let legitimacyScore = 0;
    let legitimacyReason = [];

    // Electronics/recycling content scoring
    if (recyclingScore >= 5) {
      legitimacyScore += 60;
      legitimacyReason.push(
        `Strong electronics/recycling content (${recyclingScore} matches)`
      );
    } else if (recyclingScore >= 2) {
      legitimacyScore += 35;
      legitimacyReason.push(
        `Electronics/recycling content present (${recyclingScore} matches)`
      );
    } else if (recyclingScore >= 1) {
      legitimacyScore += 15;
      legitimacyReason.push(
        `Some electronics/recycling content (${recyclingScore} matches)`
      );
    }

    // Check for specific high-value indicators
    if (
      allText.includes('e-waste') ||
      allText.includes('electronics recycling')
    ) {
      legitimacyScore += 25;
      legitimacyReason.push(
        'Mentions e-waste or electronics recycling specifically'
      );
    }

    if (
      allText.includes('trade-in') ||
      allText.includes('buyback') ||
      allText.includes('drop off') ||
      allText.includes('drop-off')
    ) {
      legitimacyScore += 20;
      legitimacyReason.push('Offers trade-in, buyback, or drop-off services');
    }

    // Check for certifications
    if (allText.includes('r2 certified') || allText.includes('iso 14001')) {
      legitimacyScore += 30;
      legitimacyReason.push('Has environmental certifications');
    }

    // Check for major retailers known for electronics recycling
    if (
      allText.includes('best buy') ||
      allText.includes('staples') ||
      allText.includes('office depot')
    ) {
      legitimacyScore += 25;
      legitimacyReason.push(
        'Major retailer known for electronics recycling programs'
      );
    }

    // Red flags - penalize non-electronics businesses
    if (redFlagScore >= 5) {
      legitimacyScore -= 40;
      legitimacyReason.push(
        `Many non-electronics business indicators (${redFlagScore} matches)`
      );
    } else if (redFlagScore >= 2) {
      legitimacyScore -= 15;
      legitimacyReason.push(
        `Some non-electronics business indicators (${redFlagScore} matches)`
      );
    }

    return {
      legitimacyScore,
      legitimacyReason: legitimacyReason.join('; '),
      isLegitimate: legitimacyScore >= 25, // Threshold for electronics recycling
      isSuspicious: legitimacyScore < -10,
      recyclingKeywordCount: recyclingScore,
      redFlagKeywordCount: redFlagScore,
    };
  }

  async processCenter(center) {
    try {
      console.log(
        `🔍 Processing: ${center.name} (${center.city}, ${center.state})`
      );
      console.log(`    Website: ${center.site}`);

      // Scrape the website
      const scrapedData = await this.scrapeWebsite(center.site, center);

      let result = {
        centerId: center.id,
        centerName: center.name,
        url: center.site,
        city: center.city,
        state: center.state,
        ...scrapedData,
      };

      if (scrapedData.success) {
        // Analyze for electronics recycling specifically
        const analysis = this.analyzeBusinessForElectronicsRecycling(
          scrapedData,
          center
        );
        result = { ...result, ...analysis };

        // Update database with results
        const { error: updateError } = await supabase
          .from('recycling_centers')
          .update({
            legitimacy_score: analysis.legitimacyScore,
            legitimacy_reason: analysis.legitimacyReason,
            is_legitimate: analysis.isLegitimate,
            is_suspicious: analysis.isSuspicious,
            scraped_at: scrapedData.scrapedAt,
          })
          .eq('id', center.id);

        if (updateError) {
          console.error(
            `❌ Error updating database for ${center.name}:`,
            updateError.message
          );
        } else {
          this.progress.scored++;
          console.log(
            `✅ Scored: ${analysis.legitimacyScore} (${
              analysis.isLegitimate ? 'LEGITIMATE' : 'NOT LEGITIMATE'
            })`
          );
        }
      } else {
        console.log(`❌ Failed to scrape: ${scrapedData.error}`);
        this.progress.failed++;
      }

      this.progress.processed++;
      console.log(
        `Progress: ${this.progress.processed}/${this.progress.total} (${this.progress.scored} scored, ${this.progress.failed} failed)\n`
      );

      return result;
    } catch (error) {
      console.error(`Error processing ${center.name}:`, error.message);
      this.progress.errors.push({
        centerId: center.id,
        centerName: center.name,
        error: error.message,
      });
      this.progress.processed++;
      return {
        centerId: center.id,
        centerName: center.name,
        error: error.message,
      };
    }
  }

  async processBatch(centers) {
    const results = [];

    for (const center of centers) {
      const result = await this.processCenter(center);
      results.push(result);

      // Delay between requests
      if (this.progress.processed < this.progress.total) {
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS)
        );
      }
    }

    return results;
  }

  async run() {
    try {
      await this.initialize();

      const centers = await this.getUnscoredWithWebsites();
      if (centers.length === 0) {
        console.log('✅ No unscored entries with websites found');
        return;
      }

      console.log(
        `🎯 Starting proper website scraping for ${centers.length} entries...\n`
      );

      // Process in batches
      const results = [];
      for (let i = 0; i < centers.length; i += CONFIG.BATCH_SIZE) {
        const batch = centers.slice(i, i + CONFIG.BATCH_SIZE);
        console.log(
          `📦 Processing batch ${
            Math.floor(i / CONFIG.BATCH_SIZE) + 1
          }/${Math.ceil(centers.length / CONFIG.BATCH_SIZE)}`
        );

        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
      }

      // Save results
      const timestamp = new Date().toISOString().split('T')[0];
      const resultsData = {
        timestamp: new Date().toISOString(),
        processed: this.progress.processed,
        scored: this.progress.scored,
        failed: this.progress.failed,
        results,
      };

      // Ensure directory exists
      const auditDir = `data/database-audit-${timestamp}`;
      if (!fs.existsSync(auditDir)) {
        fs.mkdirSync(auditDir, { recursive: true });
      }

      const filename = `${auditDir}/proper-scraping-results-${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(resultsData, null, 2));

      // Final summary
      console.log('='.repeat(70));
      console.log('🎉 PROPER WEBSITE SCRAPING COMPLETE');
      console.log('='.repeat(70));
      console.log(`📊 Processed: ${this.progress.processed} entries`);
      console.log(`✅ Successfully scored: ${this.progress.scored} entries`);
      console.log(`❌ Failed to scrape: ${this.progress.failed} entries`);
      console.log(`📁 Results saved to: ${filename}`);

      if (this.progress.errors.length > 0) {
        console.log(`⚠️  Errors encountered: ${this.progress.errors.length}`);
      }
    } catch (error) {
      console.error('❌ Error during scraping:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

const scraper = new ProperWebsiteScraper();
scraper.run();
