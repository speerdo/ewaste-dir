import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ Missing Supabase credentials. Please ensure these environment variables are set:'
  );
  console.error('   - PUBLIC_SUPABASE_URL');
  console.error('   - PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const CONFIG = {
  BATCH_SIZE: 10, // Process 10 centers at a time
  DELAY_BETWEEN_REQUESTS: 2000, // 2 seconds between requests
  TIMEOUT: 20000, // 20 second timeout per page (balanced approach)
  RETRY_TIMEOUT: 25000, // 25 second timeout for retry attempts
  MAX_RETRIES: 1, // Retry failed requests up to 1 time (faster)
  DELAY_BETWEEN_RETRIES: 3000, // 3 seconds between retry attempts
  OUTPUT_DIR: './data/scraped_data',
  PROGRESS_FILE: './data/scraping_progress.json',
};

// Keywords to identify businesses that offer electronics recycling services
const RECYCLING_KEYWORDS = [
  // Core recycling terms
  'recycle',
  'recycling',
  'e-waste',
  'electronic waste',
  'electronics recycling',
  'scrap metal',
  'computer recycling',
  'tv recycling',
  'battery recycling',
  'certified recycler',
  'r2 certified',
  'iso 14001',
  'responsible recycling',
  'waste management',
  'environmental services',
  'sustainability',

  // Electronics-related terms (retailers/repair shops that often offer recycling)
  'electronics',
  'computers',
  'laptops',
  'tablets',
  'smartphones',
  'cell phones',
  'televisions',
  'monitors',
  'printers',
  'ink cartridges',
  'toner cartridges',
  'batteries',
  'phone repair',
  'computer repair',
  'electronics repair',

  // Retail/service terms that often include recycling programs
  'trade-in',
  'trade in',
  'buy back',
  'buyback',
  'drop off',
  'drop-off',
  'collection',
  'disposal',
  'take back',
  'takeback',
  'refurbished',
  'office supplies',
  'electronics store',
  'computer store',
  'tech support',
];

// Red flag keywords for businesses unlikely to offer electronics recycling
// (More restrictive - only clear non-electronic businesses)
const RED_FLAG_KEYWORDS = [
  'casino',
  'restaurant',
  'food service',
  'dining',
  'cafe',
  'bar',
  'pub',
  'hotel',
  'motel',
  'accommodation',
  'lodging',
  'gas station',
  'fuel',
  'grocery',
  'supermarket',
  'pharmacy',
  'bank',
  'credit union',
  'insurance',
  'real estate',
  'property',
  'hair salon',
  'beauty salon',
  'nail salon',
  'clothing',
  'fashion',
  'jewelry',
  'watches',
  'dentist',
  'medical',
  'hospital',
  'clinic',
  'veterinary',
  'vet',
  'fitness',
  'gym',
];

class RecyclingCenterScraper {
  constructor() {
    this.browser = null;
    this.progress = { processed: 0, total: 0, errors: [], suspicious: [] };
    this.results = [];
  }

  // Safe logging that handles EPIPE errors
  safeLog(message) {
    try {
      console.log(message);
    } catch (error) {
      if (error.code === 'EPIPE') {
        // Output pipe closed, try stderr
        try {
          console.error(message);
        } catch (err) {
          // Both stdout and stderr failed, silently continue
        }
      } else {
        throw error;
      }
    }
  }

  async initialize() {
    // Launch browser with enhanced stealth settings
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Skip loading images for faster page loads
        '--disable-css', // Skip CSS for faster loading
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security', // Additional bypass for some sites
        '--disable-features=site-per-process', // Additional bypass
        '--ignore-certificate-errors', // Handle SSL issues
        '--ignore-ssl-errors', // Handle SSL issues
        '--allow-running-insecure-content', // Allow mixed content
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
    });

    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });

    // Load existing progress if available
    await this.loadProgress();
  }

  async loadProgress() {
    try {
      const progressData = await fs.readFile(CONFIG.PROGRESS_FILE, 'utf-8');
      this.progress = JSON.parse(progressData);
      console.log(`Resuming from center ${this.progress.processed}`);
    } catch (error) {
      console.log('Starting fresh scraping session');
    }
  }

  async saveProgress() {
    await fs.writeFile(
      CONFIG.PROGRESS_FILE,
      JSON.stringify(this.progress, null, 2)
    );
  }

  async getCentersToProcess() {
    // Get all centers with websites using pagination to handle 40k+ records
    const PAGE_SIZE = 1000; // Supabase's default limit
    let allCenters = [];
    let currentPage = 0;
    let hasMore = true;

    console.log('Fetching all recycling centers with websites...');

    while (hasMore) {
      const startIndex = currentPage * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE - 1;

      console.log(
        `Fetching page ${currentPage + 1} (rows ${startIndex}-${endIndex})...`
      );

      const { data: centers, error } = await supabase
        .from('recycling_centers')
        .select('id, name, site, city, state, description')
        .not('site', 'is', null)
        .neq('site', '')
        .order('state', { ascending: true })
        .order('city', { ascending: true })
        .range(startIndex, endIndex);

      if (error) {
        throw new Error(
          `Error fetching centers (page ${currentPage + 1}): ${error.message}`
        );
      }

      if (centers && centers.length > 0) {
        allCenters = allCenters.concat(centers);
        console.log(
          `Retrieved ${centers.length} centers (total so far: ${allCenters.length})`
        );

        // If we got fewer records than PAGE_SIZE, we've reached the end
        hasMore = centers.length === PAGE_SIZE;
        currentPage++;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allCenters.length} total centers with websites`);
    this.progress.total = allCenters.length;

    // Skip already processed centers
    const remainingCenters = allCenters.slice(this.progress.processed);
    console.log(`${remainingCenters.length} centers remaining to process`);

    return remainingCenters;
  }

  async scrapeWebsite(url, center, retryCount = 0) {
    const page = await this.browser.newPage();
    let pageIsClosed = false;

    try {
      // Randomize viewport to avoid detection patterns
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
        { width: 1536, height: 864 },
      ];
      const viewport = viewports[Math.floor(Math.random() * viewports.length)];
      await page.setViewport(viewport);

      // Rotate user agents to appear more natural
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ];
      const userAgent =
        userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(userAgent);

      // Enhanced stealth measures
      await page.evaluateOnNewDocument(() => {
        // Hide webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Mock platform
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32',
        });

        // Mock hardware properties
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 4,
        });

        // Remove automation indicators
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      });

      // Set additional headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      });

      // Selective resource blocking for faster page loads (less aggressive)
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        const url = req.url();

        // Block heavy resources but allow essential ones
        if (resourceType === 'image' && !url.includes('logo')) {
          req.abort();
        } else if (resourceType === 'font') {
          req.abort();
        } else if (resourceType === 'media') {
          req.abort();
        } else if (resourceType === 'stylesheet' && url.includes('bootstrap')) {
          // Allow some essential CSS frameworks
          req.continue();
        } else if (resourceType === 'stylesheet') {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate to the website with appropriate timeout
      const timeout = retryCount > 0 ? CONFIG.RETRY_TIMEOUT : CONFIG.TIMEOUT;
      console.log(
        `Scraping: ${url}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`
      );

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: timeout,
      });

      // Extract text content from the page
      const content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach((el) => el.remove());

        // Get all text content
        const body = document.body;
        if (!body) return '';

        // Get text from common content areas
        const selectors = [
          'main',
          '.main',
          '#main',
          '.content',
          '#content',
          '.about',
          '.services',
          '.description',
          'h1, h2, h3, p, div',
        ];

        let text = '';
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            text += ' ' + el.innerText;
          });
        }

        return text.trim();
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

      // Retry logic for certain types of errors
      if (retryCount < CONFIG.MAX_RETRIES && this.shouldRetry(error)) {
        try {
          if (!pageIsClosed) {
            await page.close();
            pageIsClosed = true;
          }
        } catch (closeError) {
          // Page already closed or browser connection lost
          console.log(`   ⚠️  Could not close page: ${closeError.message}`);
        }

        console.log(
          `⏳ Retrying ${url} (attempt ${retryCount + 1}/${
            CONFIG.MAX_RETRIES
          })...`
        );
        await this.delay(CONFIG.DELAY_BETWEEN_RETRIES);
        return this.scrapeWebsite(url, center, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        retryCount,
        scrapedAt: new Date().toISOString(),
      };
    } finally {
      try {
        if (!pageIsClosed && !page.isClosed()) {
          await page.close();
        }
      } catch (closeError) {
        // Page already closed or browser connection lost - this is fine
        console.log(
          `   ⚠️  Could not close page in finally: ${closeError.message}`
        );
      }
    }
  }

  shouldRetry(error) {
    const retryableErrors = [
      'Navigation timeout',
      'net::ERR_TIMED_OUT',
      'net::ERR_CONNECTION_REFUSED',
      'net::ERR_NAME_NOT_RESOLVED',
      'net::ERR_INTERNET_DISCONNECTED',
      'Protocol error',
      'Target closed',
    ];

    return retryableErrors.some((retryableError) =>
      error.message.includes(retryableError)
    );
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  analyzeBusinessLegitimacy(scrapedData, center) {
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

    // Determine legitimacy - more inclusive approach
    let legitimacyScore = 0;
    let legitimacyReason = [];

    // Basic electronics/recycling presence
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

    // Check for common electronics businesses that often offer recycling
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

    // Red flags - only penalize if significant presence
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
      isLegitimate: legitimacyScore >= 25, // Lowered threshold to be more inclusive
      isSuspicious: legitimacyScore < -10, // Only flag as suspicious if clearly not electronics-related
    };
  }

  async processBatch(centers) {
    const batchResults = [];

    for (const center of centers) {
      try {
        // Restart browser every 100 centers to prevent memory/state issues
        const centersSinceStart = this.progress.processed % 100;
        if (centersSinceStart === 0 && this.progress.processed > 0) {
          console.log(
            '🔄 Restarting browser for fresh state (every 100 centers)...'
          );
          if (this.browser && this.browser.isConnected()) {
            try {
              await this.browser.close();
            } catch (error) {
              console.log(
                '⚠️  Could not close browser during restart:',
                error.message
              );
            }
          }
          await this.initialize();
        }

        // Clean up the URL
        let url = center.site;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }

        // Check if browser is still connected before proceeding
        if (!this.browser || !this.browser.isConnected()) {
          console.log('🔄 Browser disconnected, reinitializing...');
          await this.initialize();
        }

        // Scrape the website
        const scrapedData = await this.scrapeWebsite(url, center);

        let result = {
          centerId: center.id,
          centerName: center.name,
          url: center.site,
          city: center.city,
          state: center.state,
          existingDescription: center.description,
          ...scrapedData,
        };

        if (scrapedData.success) {
          // Analyze business legitimacy
          const legitimacyAnalysis = this.analyzeBusinessLegitimacy(
            scrapedData,
            center
          );
          result = { ...result, ...legitimacyAnalysis };

          // Generate new description if the current one is empty or generic
          if (!center.description || center.description.length < 50) {
            result.suggestedDescription = this.generateDescription(
              scrapedData,
              center
            );
          }

          console.log(
            `✓ ${center.name} - Legitimacy Score: ${legitimacyAnalysis.legitimacyScore}`
          );
        } else {
          console.log(`✗ ${center.name} - Failed to scrape`);
        }

        batchResults.push(result);
        this.progress.processed++;

        // Add randomized delay between requests to appear more natural
        const randomDelay =
          CONFIG.DELAY_BETWEEN_REQUESTS + Math.random() * 2000; // 2-4 seconds
        await this.delay(randomDelay);
      } catch (error) {
        console.error(`Error processing ${center.name}:`, error);

        // If browser crashed, try to reinitialize
        if (
          error.message.includes('Protocol error') ||
          error.message.includes('Target closed') ||
          error.message.includes('Connection closed')
        ) {
          console.log('🔄 Browser crash detected, reinitializing...');
          try {
            if (this.browser && this.browser.isConnected()) {
              await this.browser.close();
            }
            await this.initialize();
          } catch (initError) {
            console.error('Failed to reinitialize browser:', initError);
          }
        }

        this.progress.errors.push({
          centerId: center.id,
          centerName: center.name,
          error: error.message,
        });
        this.progress.processed++;
      }
    }

    return batchResults;
  }

  generateDescription(scrapedData, center) {
    const content = scrapedData.content.toLowerCase();
    let description = '';

    // Try to extract a good description from the content
    if (
      scrapedData.metaDescription &&
      scrapedData.metaDescription.length > 50
    ) {
      description = scrapedData.metaDescription;
    } else {
      // Find sentences that mention recycling or services
      const sentences = scrapedData.content
        .split(/[.!?]+/)
        .filter((s) => s.length > 30);
      const relevantSentences = sentences.filter((sentence) => {
        const lower = sentence.toLowerCase();
        return RECYCLING_KEYWORDS.some((keyword) => lower.includes(keyword));
      });

      if (relevantSentences.length > 0) {
        description = relevantSentences[0].trim();
      }
    }

    // Fallback to a generic description
    if (!description || description.length < 30) {
      description = `${center.name} is a recycling center located in ${center.city}, ${center.state}. Contact them for information about their electronics recycling services and accepted materials.`;
    }

    // Limit description length
    if (description.length > 300) {
      description = description.substring(0, 297) + '...';
    }

    return description;
  }

  async saveResults(batchResults) {
    this.results.push(...batchResults);

    // Save batch results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scraping_results_${timestamp}.json`;
    await fs.writeFile(
      path.join(CONFIG.OUTPUT_DIR, filename),
      JSON.stringify(batchResults, null, 2)
    );

    // Update progress
    await this.saveProgress();

    console.log(`Saved ${batchResults.length} results to ${filename}`);
  }

  async run() {
    try {
      await this.initialize();
      const centers = await this.getCentersToProcess();

      console.log(`Starting to process ${centers.length} remaining centers...`);

      // Process in batches
      for (let i = 0; i < centers.length; i += CONFIG.BATCH_SIZE) {
        const batch = centers.slice(i, i + CONFIG.BATCH_SIZE);
        const currentBatch = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(centers.length / CONFIG.BATCH_SIZE);

        console.log(
          `\nProcessing batch ${currentBatch}/${totalBatches} (${batch.length} centers)...`
        );

        const batchResults = await this.processBatch(batch);
        await this.saveResults(batchResults);

        // Progress report
        const suspicious = batchResults.filter((r) => r.isSuspicious).length;
        const legitimate = batchResults.filter((r) => r.isLegitimate).length;

        console.log(
          `Batch complete: ${legitimate} legitimate, ${suspicious} suspicious`
        );
        console.log(
          `Overall progress: ${this.progress.processed}/${
            this.progress.total
          } (${Math.round(
            (this.progress.processed / this.progress.total) * 100
          )}%)`
        );
      }

      await this.generateSummaryReport();
    } catch (error) {
      console.error('Scraping failed:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async generateSummaryReport() {
    const summary = {
      totalProcessed: this.progress.processed,
      totalErrors: this.progress.errors.length,
      legitimateBusinesses: this.results.filter((r) => r.isLegitimate).length,
      suspiciousBusinesses: this.results.filter((r) => r.isSuspicious).length,
      centersWithNewDescriptions: this.results.filter(
        (r) => r.suggestedDescription
      ).length,
      completedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(CONFIG.OUTPUT_DIR, 'scraping_summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Generate separate files for suspicious centers for review
    await this.generateSuspiciousCentersReport();

    console.log('\n=== SCRAPING COMPLETE ===');
    console.log(`Total processed: ${summary.totalProcessed}`);
    console.log(`Legitimate businesses: ${summary.legitimateBusinesses}`);
    console.log(`Suspicious businesses: ${summary.suspiciousBusinesses}`);
    console.log(
      `New descriptions generated: ${summary.centersWithNewDescriptions}`
    );
    console.log(`Errors: ${summary.totalErrors}`);
  }

  async generateSuspiciousCentersReport() {
    const suspiciousCenters = this.results.filter(
      (r) => r.isSuspicious && r.success
    );

    if (suspiciousCenters.length === 0) {
      console.log('No suspicious centers found - no review file needed');
      return;
    }

    // Generate JSON file for suspicious centers
    const suspiciousJsonFile = path.join(
      CONFIG.OUTPUT_DIR,
      'suspicious_centers_for_review.json'
    );
    await fs.writeFile(
      suspiciousJsonFile,
      JSON.stringify(suspiciousCenters, null, 2)
    );

    // Generate CSV for easy manual review
    const csvHeaders =
      'Center ID,Name,City,State,Website,Legitimacy Score,Reason,Phone,Existing Description\n';
    const csvRows = suspiciousCenters.map((center) => {
      const phone = center.contactInfo?.phones?.[0] || '';
      const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;

      return [
        center.centerId,
        escapeCsv(center.centerName),
        center.city,
        center.state,
        center.url,
        center.legitimacyScore,
        escapeCsv(center.legitimacyReason),
        phone,
        escapeCsv(center.existingDescription || ''),
      ].join(',');
    });

    const csvContent = csvHeaders + csvRows.join('\n');
    const suspiciousCsvFile = path.join(
      CONFIG.OUTPUT_DIR,
      'suspicious_centers_for_review.csv'
    );
    await fs.writeFile(suspiciousCsvFile, csvContent);

    console.log(`📋 Generated suspicious centers review files:`);
    console.log(
      `   JSON: suspicious_centers_for_review.json (${suspiciousCenters.length} centers)`
    );
    console.log(
      `   CSV:  suspicious_centers_for_review.csv (for spreadsheet review)`
    );
    console.log(
      `\n🔍 Review these ${suspiciousCenters.length} suspicious centers to consider removal from database`
    );
  }
}

// Global error handlers for graceful shutdown
process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE') {
    process.exit(0); // Exit gracefully on broken pipe
  } else {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  }
});

process.on('SIGPIPE', () => {
  process.exit(0); // Exit gracefully on SIGPIPE
});

// Run the scraper
if (import.meta.url === new URL(import.meta.url).href) {
  const scraper = new RecyclingCenterScraper();
  scraper.run().catch(console.error);
}
