import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
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

// Test Configuration (matching main scraper)
const TEST_CONFIG = {
  TIMEOUT: 20000, // 20 second timeout (matching main scraper)
  RETRY_TIMEOUT: 25000, // 25 second timeout for retry attempts
  MAX_RETRIES: 1, // Retry failed requests up to 1 time
  DELAY_BETWEEN_RETRIES: 3000, // 3 seconds between retry attempts
};

// Test with recently failed URLs from user's logs
const FAILED_URLS_TO_TEST = [
  {
    name: 'Need A Geek, LLC',
    url: 'http://nagitechs.net/',
    location: 'KS',
  },
  {
    name: 'EcoATM Hutchinson',
    url: 'https://locations.ecoatm.com/ks/hutchinson/sell-my-phone-hutchinson-ks-7626.html',
    location: 'Hutchinson, KS',
  },
  {
    name: 'CMC Recycling',
    url: 'http://www.cmcrecyclingindependence.com/',
    location: 'Independence, KS',
  },
  {
    name: 'R6 Recycling',
    url: 'http://r6recycling.com/',
    location: 'KS',
  },
  {
    name: 'Geary County Recycling',
    url: 'https://www.gearycounty.org/177/Recycling-Center',
    location: 'Geary County, KS',
  },
  {
    name: 'EcoATM Junction City',
    url: 'https://locations.ecoatm.com/ks/junctioncity/sell-my-phone-junctioncity-ks-1443.html',
    location: 'Junction City, KS',
  },
  {
    name: 'Legacy Electronics',
    url: 'https://legacyelectricks.com/',
    location: 'KS',
  },
];

class EnhancedScrapingTester {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    console.log('🔧 Initializing enhanced stealth test scraper...');

    // Launch browser with enhanced stealth settings (matching main scraper)
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
        '--disable-javascript', // We don't need JS for content extraction
        '--disable-css', // Skip CSS for faster loading
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
    });
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  async testWebsiteScraping(testSite, retryCount = 0) {
    const page = await this.browser.newPage();

    try {
      console.log(`🔍 Testing: ${testSite.name} (${testSite.location})`);
      console.log(
        `   URL: ${testSite.url}${
          retryCount > 0 ? ` (retry ${retryCount})` : ''
        }`
      );

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

        // Remove automation indicators
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      });

      // Disable loading of unnecessary resources for faster page loads
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate with appropriate timeout
      const timeout =
        retryCount > 0 ? TEST_CONFIG.RETRY_TIMEOUT : TEST_CONFIG.TIMEOUT;

      await page.goto(testSite.url, {
        waitUntil: 'domcontentloaded',
        timeout: timeout,
      });

      // Extract content
      const title = await page.title();
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

      console.log(`   ✅ SUCCESS - Title: ${title.substring(0, 60)}...`);
      console.log(
        `   📄 Content preview: ${content
          .substring(0, 100)
          .replace(/\s+/g, ' ')}...`
      );

      // Quick check for electronics/recycling keywords
      const electronicsKeywords = [
        'electronics',
        'recycle',
        'computer',
        'phone',
        'repair',
        'trade-in',
        'e-waste',
        'recycling',
        'buyback',
        'drop-off',
        'disposal',
      ];
      const allText = (title + ' ' + content).toLowerCase();
      const foundKeywords = electronicsKeywords.filter((keyword) =>
        allText.includes(keyword)
      );

      console.log(
        `   📱 Electronics/Recycling keywords found: ${
          foundKeywords.length > 0 ? foundKeywords.join(', ') : 'None'
        }`
      );

      return {
        success: true,
        title,
        contentLength: content.length,
        keywordsFound: foundKeywords,
        retryCount,
      };
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);

      // Retry logic for certain types of errors
      if (retryCount < TEST_CONFIG.MAX_RETRIES && this.shouldRetry(error)) {
        await page.close();
        console.log(
          `   ⏳ Retrying ${testSite.name} (attempt ${retryCount + 1}/${
            TEST_CONFIG.MAX_RETRIES
          })...`
        );
        await this.delay(TEST_CONFIG.DELAY_BETWEEN_RETRIES);
        return this.testWebsiteScraping(testSite, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        retryCount,
      };
    } finally {
      await page.close();
    }
  }

  async runTest() {
    try {
      await this.initialize();

      console.log(
        `\n🚀 Testing enhanced stealth scraper with ${FAILED_URLS_TO_TEST.length} recently failed URLs...\n`
      );
      console.log('⚙️  Configuration:');
      console.log(
        `   - Timeout: ${TEST_CONFIG.TIMEOUT / 1000}s (base), ${
          TEST_CONFIG.RETRY_TIMEOUT / 1000
        }s (retry)`
      );
      console.log(`   - Max retries: ${TEST_CONFIG.MAX_RETRIES}`);
      console.log(
        `   - Enhanced stealth: ✅ (randomized user agents, viewports, resource blocking)`
      );
      console.log(
        `   - Resource blocking: ✅ (images, CSS, fonts disabled for speed)\n`
      );

      let successCount = 0;
      let retrySuccessCount = 0;
      const results = [];

      for (const testSite of FAILED_URLS_TO_TEST) {
        const result = await this.testWebsiteScraping(testSite);
        results.push(result);

        if (result.success) {
          successCount++;
          if (result.retryCount > 0) {
            retrySuccessCount++;
          }
        }

        // Add randomized delay between tests to appear more natural
        const randomDelay = 2000 + Math.random() * 2000; // 2-4 seconds
        await this.delay(randomDelay);
      }

      console.log('\n📊 Enhanced Stealth Test Results:');
      console.log(`   Total tested: ${FAILED_URLS_TO_TEST.length}`);
      console.log(`   Successful: ${successCount}`);
      console.log(
        `   Failed initially but succeeded on retry: ${retrySuccessCount}`
      );
      console.log(
        `   Success rate: ${Math.round(
          (successCount / FAILED_URLS_TO_TEST.length) * 100
        )}%`
      );

      if (successCount > 0) {
        console.log(`\n✅ Enhanced stealth measures are working!`);
        console.log(
          `   ${successCount}/${FAILED_URLS_TO_TEST.length} previously failed URLs now succeed`
        );
        if (retrySuccessCount > 0) {
          console.log(
            `   ${retrySuccessCount} sites succeeded only after retry (retry system working!)`
          );
        }
        console.log(
          '\n🚀 Ready to run the full scraping process with improved success rate.'
        );
        console.log('Run: npm run scrape-websites');
      } else {
        console.log(
          '\n❌ All tests still failed. May need to investigate specific network/infrastructure issues.'
        );
      }

      // Show detailed results
      console.log('\n📋 Detailed Results:');
      results.forEach((result, index) => {
        const site = FAILED_URLS_TO_TEST[index];
        console.log(
          `   ${result.success ? '✅' : '❌'} ${site.name}: ${
            result.success ? 'Success' : result.error
          }${result.retryCount > 0 ? ` (retry ${result.retryCount})` : ''}`
        );
      });
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Run the enhanced test
const tester = new EnhancedScrapingTester();
tester.runTest().catch(console.error);
