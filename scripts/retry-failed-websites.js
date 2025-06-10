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

// Configuration - Enhanced stealth settings
const CONFIG = {
  BATCH_SIZE: 5, // Smaller batches for more stable processing
  DELAY_BETWEEN_REQUESTS: 4000, // 4 seconds between requests (slower for stability)
  TIMEOUT: 35000, // 35 second timeout per page (more patient for retry)
  RETRY_TIMEOUT: 50000, // 50 second timeout for retry attempts
  MAX_RETRIES: 2, // Retry failed requests up to 2 times
  DELAY_BETWEEN_RETRIES: 8000, // 8 seconds between retry attempts (more patience)
  OUTPUT_DIR: './data/scraped_data',
  RETRY_PROGRESS_FILE: './data/retry_progress.json',
};

// Keywords for legitimacy analysis (same as main scraper)
const RECYCLING_KEYWORDS = [
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

class FailedWebsiteRetrier {
  constructor() {
    this.browser = null;
    this.progress = { processed: 0, total: 0, errors: [], retrySuccess: 0 };
    this.results = [];
  }

  async initialize() {
    // Close existing browser if any
    if (this.browser && this.browser.isConnected()) {
      try {
        await this.browser.close();
      } catch (error) {
        console.log('⚠️  Could not close existing browser:', error.message);
      }
    }

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

    // Load existing retry progress if available
    await this.loadRetryProgress();
  }

  async loadRetryProgress() {
    try {
      const progressData = await fs.readFile(
        CONFIG.RETRY_PROGRESS_FILE,
        'utf-8'
      );
      this.progress = JSON.parse(progressData);
      console.log(`Resuming retry from center ${this.progress.processed}`);
    } catch (error) {
      console.log('Starting fresh retry session');
    }
  }

  async saveRetryProgress() {
    await fs.writeFile(
      CONFIG.RETRY_PROGRESS_FILE,
      JSON.stringify(this.progress, null, 2)
    );
  }

  async getFailedCenters() {
    console.log(
      '🔍 Analyzing existing scraping results to identify failed websites...'
    );

    const failedCenters = [];
    const dataDir = CONFIG.OUTPUT_DIR;

    try {
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(
        (file) => file.startsWith('scraping_results_') && file.endsWith('.json')
      );

      console.log(`📂 Found ${jsonFiles.length} result files to analyze...`);

      for (const file of jsonFiles) {
        const filePath = path.join(dataDir, file);
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const results = JSON.parse(data);

          // Find failed entries (success: false)
          const failed = results.filter((result) => result.success === false);

          for (const failedResult of failed) {
            // Check if it's a retryable error using same logic as main scraper
            const isRetryable = this.shouldRetry({
              message: failedResult.error,
            });

            if (isRetryable) {
              failedCenters.push({
                id: failedResult.centerId,
                name: failedResult.centerName,
                site: failedResult.url,
                city: failedResult.city,
                state: failedResult.state,
                existingDescription: failedResult.existingDescription,
                originalError: failedResult.error,
                sourceFile: file,
              });
            }
          }
        } catch (error) {
          console.warn(`⚠️  Could not parse ${file}: ${error.message}`);
        }
      }

      // Remove duplicates based on center ID
      const uniqueFailedCenters = failedCenters.filter(
        (center, index, self) =>
          index === self.findIndex((c) => c.id === center.id)
      );

      console.log(`📊 Analysis complete:`);
      console.log(`   - Total failed entries found: ${failedCenters.length}`);
      console.log(
        `   - Unique failed centers (retryable): ${uniqueFailedCenters.length}`
      );

      this.progress.total = uniqueFailedCenters.length;

      // Skip already retried centers
      const remainingCenters = uniqueFailedCenters.slice(
        this.progress.processed
      );
      console.log(`   - Remaining to retry: ${remainingCenters.length}`);

      return remainingCenters;
    } catch (error) {
      throw new Error(`Error reading results directory: ${error.message}`);
    }
  }

  shouldRetry(error) {
    // Smart retry logic - be more selective about what to retry
    const retryableErrors = [
      'Navigation timeout',
      'net::ERR_TIMED_OUT',
      'net::ERR_INTERNET_DISCONNECTED',
      'net::ERR_CONNECTION_RESET',
      'net::ERR_EMPTY_RESPONSE',
      'Protocol error',
      'Target closed',
      'net::ERR_CONNECTION_REFUSED', // Sometimes temporary
    ];

    // Do NOT retry these truly permanent failures
    const permanentErrors = [
      'net::ERR_NAME_NOT_RESOLVED', // Dead domains
      'net::ERR_ADDRESS_UNREACHABLE', // Network routing issues
      'net::ERR_CERT_', // Certificate errors (often permanent)
      'ERR_BLOCKED_BY_CLIENT', // Our own blocking (don't retry)
      'net::ERR_ABORTED', // Request was aborted
    ];

    const errorMessage = error.message || '';

    // Check if it's a permanent error first
    const isPermanent = permanentErrors.some((permanentError) =>
      errorMessage.includes(permanentError)
    );

    if (isPermanent) {
      console.log(
        `   🚫 Permanent error detected, skipping retry: ${errorMessage}`
      );
      return false; // Don't retry permanent failures
    }

    // Check if it's a retryable error
    const isRetryable = retryableErrors.some((retryableError) =>
      errorMessage.includes(retryableError)
    );

    if (isRetryable) {
      console.log(`   🔄 Retryable error detected: ${errorMessage}`);
      return true;
    }

    // For unknown errors, be conservative and don't retry
    console.log(`   ❓ Unknown error type, skipping retry: ${errorMessage}`);
    return false;
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  safeLog(message) {
    try {
      console.log(message);
    } catch (error) {
      // Handle EPIPE and other output stream errors gracefully
      if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
        // Pipe is broken, continue silently
        return;
      }
      // For other errors, try to write to stderr
      try {
        process.stderr.write(message + '\n');
      } catch (stderrError) {
        // If even stderr fails, just continue silently
      }
    }
  }

  async scrapeWebsite(url, center, retryCount = 0) {
    const page = await this.browser.newPage();
    let pageIsClosed = false;
    const useRequestInterception = retryCount === 0; // Disable on retry to avoid ERR_BLOCKED_BY_CLIENT

    try {
      // Set a more generous timeout for retries of previously failed sites
      const baseTimeout =
        retryCount > 0 ? CONFIG.RETRY_TIMEOUT : CONFIG.TIMEOUT;
      const finalTimeout = Math.min(baseTimeout + retryCount * 10000, 60000); // Max 60s

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
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 4,
        });
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

        // Additional stealth measures for retry attempts
        if (retryCount > 0) {
          // Override timing functions to avoid detection
          window.setTimeout = window.setTimeout;
          window.setInterval = window.setInterval;
          // Hide automation properties
          Object.defineProperty(window, 'outerHeight', { get: () => 900 });
          Object.defineProperty(window, 'outerWidth', { get: () => 1440 });
        }
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
        // Add referrer for retry attempts to appear more natural
        ...(retryCount > 0 && { Referer: 'https://www.google.com/' }),
      });

      // Conditional resource blocking - disable on retry to avoid ERR_BLOCKED_BY_CLIENT
      if (useRequestInterception) {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          const url = req.url();

          // Only block the heaviest resources to avoid blocking essential content
          if (resourceType === 'image' && url.includes('banner')) {
            req.abort();
          } else if (resourceType === 'media' && url.includes('video')) {
            req.abort();
          } else {
            // Allow everything else including CSS, fonts, and most images
            req.continue();
          }
        });
      }

      // Navigate with appropriate timeout
      console.log(
        `🔄 Retrying: ${url}${
          retryCount > 0 ? ` (attempt ${retryCount})` : ''
        } [timeout: ${finalTimeout}ms]`
      );

      // Add a small delay before navigation for retry attempts
      if (retryCount > 0) {
        await this.delay(1000 + retryCount * 500); // 1-2s delay for retries
      }

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: finalTimeout,
      });

      // Wait a bit more for dynamic content on retry attempts
      if (retryCount > 0) {
        await this.delay(2000); // Extra 2s for dynamic content
      }

      // Extract content (same as main scraper)
      const content = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach((el) => el.remove());

        const body = document.body;
        if (!body) return '';

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

      const title = await page.title();
      const metaDescription = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="description"]');
        return meta ? meta.getAttribute('content') : '';
      });

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
        content: content.substring(0, 5000),
        contactInfo,
        scrapedAt: new Date().toISOString(),
        retryAttempt: true,
        originalError: center.originalError,
        finalTimeout,
      };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);

      // Enhanced retry logic with different strategies
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

        // Longer delay for retry attempts with exponential backoff
        const retryDelay = CONFIG.DELAY_BETWEEN_RETRIES + retryCount * 2000;
        console.log(
          `⏳ Retrying ${url} (attempt ${retryCount + 1}/${
            CONFIG.MAX_RETRIES
          }) after ${retryDelay}ms delay...`
        );
        await this.delay(retryDelay);
        return this.scrapeWebsite(url, center, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        retryCount,
        scrapedAt: new Date().toISOString(),
        retryAttempt: true,
        originalError: center.originalError,
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

  analyzeBusinessLegitimacy(scrapedData, center) {
    // Same legitimacy analysis as main scraper
    const allText =
      `${scrapedData.title} ${scrapedData.metaDescription} ${scrapedData.content}`.toLowerCase();

    const recyclingScore = RECYCLING_KEYWORDS.reduce((score, keyword) => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      return score + matches;
    }, 0);

    const redFlagScore = RED_FLAG_KEYWORDS.reduce((score, keyword) => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      return score + matches;
    }, 0);

    let legitimacyScore = 0;
    let legitimacyReason = [];

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
      // Check for termination signal
      if (process.exitCode === 0) {
        console.log('⚠️  Shutdown requested, stopping batch processing...');
        break;
      }

      try {
        let url = center.site;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }

        // Restart browser every 50 centers to prevent memory/state issues
        const centersSinceStart = this.progress.processed % 50;
        if (centersSinceStart === 0 && this.progress.processed > 0) {
          console.log(
            '🔄 Restarting browser for fresh state (every 50 centers)...'
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

        // Check if browser is still connected before proceeding
        if (!this.browser || !this.browser.isConnected()) {
          console.log('🔄 Browser disconnected, reinitializing...');
          await this.initialize();
        }

        // Add a global timeout to prevent hanging
        const scrapedData = await Promise.race([
          this.scrapeWebsite(url, center),
          new Promise(
            (_, reject) =>
              setTimeout(
                () => reject(new Error('Global operation timeout')),
                120000
              ) // 2 minute max
          ),
        ]);

        let result = {
          centerId: center.id,
          centerName: center.name,
          url: center.site,
          city: center.city,
          state: center.state,
          existingDescription: center.existingDescription,
          ...scrapedData,
        };

        if (scrapedData.success) {
          const legitimacyAnalysis = this.analyzeBusinessLegitimacy(
            scrapedData,
            center
          );
          result = { ...result, ...legitimacyAnalysis };

          if (
            !center.existingDescription ||
            center.existingDescription.length < 50
          ) {
            result.suggestedDescription = this.generateDescription(
              scrapedData,
              center
            );
          }

          console.log(
            `✅ ${center.name} - RETRY SUCCESS - Legitimacy Score: ${legitimacyAnalysis.legitimacyScore}`
          );
          this.progress.retrySuccess++;
        } else {
          console.log(`❌ ${center.name} - Still failed after retry`);
        }

        batchResults.push(result);
        this.progress.processed++;

        // Add randomized delay between requests to prevent overwhelming
        const randomDelay =
          CONFIG.DELAY_BETWEEN_REQUESTS + Math.random() * 2000; // 3-5 seconds
        await this.delay(randomDelay);
      } catch (error) {
        console.error(
          `Error processing retry for ${center.name}:`,
          error.message
        );

        // If it's a browser connection error, try to reinitialize
        if (
          error.message.includes('Target closed') ||
          error.message.includes('Protocol error') ||
          error.message.includes('Browser has been closed') ||
          error.message.includes('Global operation timeout')
        ) {
          console.log(
            '🔄 Browser error detected, will reinitialize on next batch...'
          );
          // Force browser restart on next iteration
          if (this.browser && this.browser.isConnected()) {
            try {
              await this.browser.close();
            } catch (closeError) {
              console.log('⚠️  Could not close browser:', closeError.message);
            }
          }
          this.browser = null;
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
    // Same description generation as main scraper
    let description = '';

    if (
      scrapedData.metaDescription &&
      scrapedData.metaDescription.length > 50
    ) {
      description = scrapedData.metaDescription;
    } else {
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

    if (!description || description.length < 30) {
      description = `${center.name} is a recycling center located in ${center.city}, ${center.state}. Contact them for information about their electronics recycling services and accepted materials.`;
    }

    if (description.length > 300) {
      description = description.substring(0, 297) + '...';
    }

    return description;
  }

  async saveResults(batchResults) {
    this.results.push(...batchResults);

    // Save retry results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `retry_results_${timestamp}.json`;
    await fs.writeFile(
      path.join(CONFIG.OUTPUT_DIR, filename),
      JSON.stringify(batchResults, null, 2)
    );

    // Update progress
    await this.saveRetryProgress();

    console.log(`💾 Saved ${batchResults.length} retry results to ${filename}`);
  }

  async run() {
    try {
      await this.initialize();
      const failedCenters = await this.getFailedCenters();

      if (failedCenters.length === 0) {
        console.log(
          '🎉 No retryable failed websites found! All previous attempts were successful or permanently failed.'
        );
        return;
      }

      console.log(
        `\n🚀 Starting to retry ${failedCenters.length} previously failed websites with enhanced stealth measures...\n`
      );

      // Process in batches
      for (let i = 0; i < failedCenters.length; i += CONFIG.BATCH_SIZE) {
        const batch = failedCenters.slice(i, i + CONFIG.BATCH_SIZE);
        const currentBatch = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(
          failedCenters.length / CONFIG.BATCH_SIZE
        );

        console.log(
          `\n🔄 Processing retry batch ${currentBatch}/${totalBatches} (${batch.length} centers)...`
        );

        const batchResults = await this.processBatch(batch);
        await this.saveResults(batchResults);

        // Progress report
        const successful = batchResults.filter((r) => r.success).length;
        const stillFailed = batchResults.filter((r) => !r.success).length;

        console.log(
          `Retry batch complete: ${successful} now successful, ${stillFailed} still failed`
        );
        console.log(
          `Overall retry progress: ${this.progress.processed}/${
            this.progress.total
          } (${Math.round(
            (this.progress.processed / this.progress.total) * 100
          )}%)`
        );
        console.log(
          `Total retry successes so far: ${this.progress.retrySuccess}`
        );
      }

      await this.generateRetryReport();
    } catch (error) {
      console.error('Retry process failed:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async generateRetryReport() {
    const summary = {
      totalRetried: this.progress.processed,
      totalErrors: this.progress.errors.length,
      newSuccesses: this.progress.retrySuccess,
      successRate: Math.round(
        (this.progress.retrySuccess / this.progress.processed) * 100
      ),
      legitimateBusinesses: this.results.filter((r) => r.isLegitimate).length,
      suspiciousBusinesses: this.results.filter((r) => r.isSuspicious).length,
      completedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(CONFIG.OUTPUT_DIR, 'retry_summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n🎉 RETRY PROCESS COMPLETE 🎉');
    console.log(`📊 Retry Results Summary:`);
    console.log(`   Total websites retried: ${summary.totalRetried}`);
    console.log(
      `   Previously failed sites now successful: ${summary.newSuccesses}`
    );
    console.log(`   Retry success rate: ${summary.successRate}%`);
    console.log(
      `   New legitimate businesses found: ${summary.legitimateBusinesses}`
    );
    console.log(
      `   New suspicious businesses found: ${summary.suspiciousBusinesses}`
    );
    console.log(`   Errors during retry: ${summary.totalErrors}`);
  }
}

// Global retrier instance for cleanup
let globalRetrier = null;

// Graceful shutdown function
async function gracefulShutdown(signal) {
  console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);

  if (globalRetrier && globalRetrier.browser) {
    try {
      console.log('🔄 Closing browser...');
      await globalRetrier.browser.close();
      console.log('✅ Browser closed successfully');
    } catch (error) {
      console.log('⚠️  Could not close browser:', error.message);
    }
  }

  // Save any pending progress
  if (globalRetrier) {
    try {
      await globalRetrier.saveRetryProgress();
      console.log('✅ Progress saved successfully');
    } catch (error) {
      console.log('⚠️  Could not save progress:', error.message);
    }
  }

  console.log('👋 Goodbye!');
  process.exit(0);
}

// Handle Ctrl+C (SIGINT)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle termination (SIGTERM)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors gracefully (especially EPIPE)
process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
    // Broken pipe - likely output was piped to a command that exited
    // Continue processing silently
    return;
  }
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Handle SIGPIPE gracefully
process.on('SIGPIPE', () => {
  // Broken pipe signal - ignore and continue
});

// Run the retry process
const retrier = new FailedWebsiteRetrier();
globalRetrier = retrier; // Store for cleanup

retrier
  .run()
  .catch((error) => {
    if (error.code !== 'EPIPE' && error.code !== 'ECONNRESET') {
      console.error('Retry process failed:', error);
    }
  })
  .finally(() => {
    // Clean exit when done
    if (globalRetrier && globalRetrier.browser) {
      globalRetrier.browser.close().catch(() => {});
    }
  });
