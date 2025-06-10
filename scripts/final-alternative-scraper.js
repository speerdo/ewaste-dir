import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import csv from 'csv-parser';
import { createReadStream } from 'fs';

// Configuration
const CONFIG = {
  STRATEGY_DIR: './data/final_scraping',
  OUTPUT_DIR: './data/final_scraping_results',
  PROGRESS_FILE: './data/final_scraping_progress.json',
  BATCH_SIZE: 5, // Smaller batch size for external searches
  DELAY_BETWEEN_REQUESTS: 3000, // 3 seconds between requests to be respectful
  TIMEOUT: 25000, // 25 second timeout per page
  MAX_RETRIES: 2, // Retry failed requests
  DELAY_BETWEEN_RETRIES: 5000, // 5 seconds between retry attempts
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Alternative search sources to try
  SEARCH_SOURCES: [
    {
      name: 'yelp',
      baseUrl: 'https://www.yelp.com/search',
      searchParams: (query, location) =>
        `?find_desc=${encodeURIComponent(query)}&find_loc=${encodeURIComponent(
          location
        )}`,
      resultSelector: '.businessName__09f24__3Wql2 a, .css-1m051bw a',
      urlSelector: 'href',
      enabled: true,
    },
    {
      name: 'yellowpages',
      baseUrl: 'https://www.yellowpages.com/search',
      searchParams: (query, location) =>
        `?search_terms=${encodeURIComponent(
          query
        )}&geo_location_terms=${encodeURIComponent(location)}`,
      resultSelector: '.result .business-name a, .srp-listing .business-name a',
      urlSelector: 'href',
      enabled: true,
    },
    {
      name: 'google_business',
      baseUrl: 'https://www.google.com/search',
      searchParams: (query, location) =>
        `?q=${encodeURIComponent(query + ' ' + location + ' business')}`,
      resultSelector: 'a[href*="://"]',
      urlSelector: 'href',
      enabled: true,
    },
  ],
};

// Keywords for business legitimacy analysis (consistent with existing scripts)
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

  // Electronics-related terms
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

  // Service terms
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

class AlternativeSourceScraper {
  constructor() {
    this.browser = null;
    this.progress = {
      phase: null,
      processed: 0,
      total: 0,
      errors: [],
      websitesFound: 0,
      startedAt: null,
      lastSavedAt: null,
    };
    this.results = new Map(); // Use Map to prevent duplicates
  }

  async initialize() {
    console.log('🚀 Initializing Final Alternative Source Scraper...');

    // Launch browser with stealth settings
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
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--allow-running-insecure-content',
        `--user-agent=${CONFIG.USER_AGENT}`,
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
      this.progress = { ...this.progress, ...JSON.parse(progressData) };
      console.log(
        `📋 Resuming ${this.progress.phase} from center ${this.progress.processed}/${this.progress.total}`
      );
    } catch (error) {
      console.log('🆕 Starting fresh final scraping session');
    }
  }

  async saveProgress() {
    this.progress.lastSavedAt = new Date().toISOString();
    await fs.writeFile(
      CONFIG.PROGRESS_FILE,
      JSON.stringify(this.progress, null, 2)
    );
  }

  async loadPhaseTargets(phase) {
    console.log(`📂 Loading ${phase} targets...`);

    // Find the most recent phase target file
    const files = await fs.readdir(CONFIG.STRATEGY_DIR);
    const phaseFile = files
      .filter((f) => f.startsWith(`${phase}_targets_`) && f.endsWith('.csv'))
      .sort()
      .pop();

    if (!phaseFile) {
      throw new Error(`No target file found for ${phase}`);
    }

    const filePath = path.join(CONFIG.STRATEGY_DIR, phaseFile);
    console.log(`📄 Using target file: ${phaseFile}`);

    const centers = [];
    return new Promise((resolve, reject) => {
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const center = {
            id: row['Center ID'],
            name: row['Name'],
            city: row['City'],
            state: row['State'],
            phone: row['Phone'],
            priorityScore: parseFloat(row['Priority Score']) || 0,
            legitimacyScore: parseInt(row['Legitimacy Score']) || 0,
            confidence: parseInt(row['Confidence']) || 0,
            existingWebsite: row['Existing Website'] || null,
            searchQueries: row['Search Queries']
              ? row['Search Queries'].split('; ')
              : [],
          };
          centers.push(center);
        })
        .on('end', () => {
          console.log(`✅ Loaded ${centers.length} centers for ${phase}`);
          resolve(centers);
        })
        .on('error', reject);
    });
  }

  async searchAlternativeSources(center) {
    const foundWebsites = new Set();
    const searchResults = {
      centerId: center.id,
      centerName: center.name,
      city: center.city,
      state: center.state,
      phone: center.phone,
      priorityScore: center.priorityScore,
      legitimacyScore: center.legitimacyScore,
      existingWebsite: center.existingWebsite,
      searchedAt: new Date().toISOString(),
      sources: {},
      websitesFound: [],
      bestWebsite: null,
      success: false,
    };

    const page = await this.browser.newPage();

    try {
      // Set realistic browser properties
      await page.setUserAgent(CONFIG.USER_AGENT);
      await page.setViewport({ width: 1920, height: 1080 });

      // Set extra headers to appear more human-like
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });

      // Try each enabled search source
      for (const source of CONFIG.SEARCH_SOURCES.filter((s) => s.enabled)) {
        try {
          console.log(`  🔍 Searching ${source.name}...`);

          const location = `${center.city}, ${center.state}`;
          const searchUrl =
            source.baseUrl + source.searchParams(center.name, location);

          await page.goto(searchUrl, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.TIMEOUT,
          });

          // Random delay to appear more human-like
          await this.delay(1000 + Math.random() * 2000);

          // Extract potential business links
          const links = await page.evaluate(
            (selector, urlAttr) => {
              const elements = document.querySelectorAll(selector);
              const urls = [];

              elements.forEach((el) => {
                const url = el.getAttribute(urlAttr);
                const text = el.textContent?.trim();
                if (url && text) {
                  urls.push({ url, text });
                }
              });

              return urls;
            },
            source.resultSelector,
            source.urlSelector
          );

          // Filter and process found links
          const businessUrls = this.filterBusinessUrls(links, center);

          searchResults.sources[source.name] = {
            searchUrl,
            linksFound: links.length,
            businessUrls: businessUrls.length,
            urls: businessUrls,
          };

          // Add found websites to our collection
          businessUrls.forEach((urlData) => {
            if (this.isValidBusinessUrl(urlData.url)) {
              foundWebsites.add(urlData.url);
            }
          });

          console.log(
            `    📊 Found ${businessUrls.length} potential business URLs`
          );
        } catch (error) {
          console.log(
            `    ❌ Error searching ${source.name}: ${error.message}`
          );
          searchResults.sources[source.name] = {
            error: error.message,
          };
        }

        // Delay between sources to be respectful
        await this.delay(CONFIG.DELAY_BETWEEN_REQUESTS);
      }
    } catch (error) {
      console.log(`  ❌ General search error: ${error.message}`);
      searchResults.error = error.message;
    } finally {
      await page.close();
    }

    // Process found websites
    searchResults.websitesFound = Array.from(foundWebsites);
    searchResults.success = foundWebsites.size > 0;

    if (foundWebsites.size > 0) {
      // Select the best website (prioritize official business sites)
      searchResults.bestWebsite = this.selectBestWebsite(
        Array.from(foundWebsites),
        center
      );

      // If we found a good website, scrape it for legitimacy analysis
      if (searchResults.bestWebsite) {
        const scrapedData = await this.scrapeWebsiteContent(
          searchResults.bestWebsite
        );
        if (scrapedData.success) {
          const legitimacy = this.analyzeBusinessLegitimacy(
            scrapedData,
            center
          );
          searchResults.scrapedContent = scrapedData;
          searchResults.legitimacyAnalysis = legitimacy;
          searchResults.finalLegitimacyScore = legitimacy.legitimacyScore;
          searchResults.isLegitimate = legitimacy.isLegitimate;
          searchResults.isSuspicious = legitimacy.isSuspicious;
        }
      }
    }

    return searchResults;
  }

  filterBusinessUrls(links, center) {
    const businessUrls = [];
    const centerNameLower = center.name.toLowerCase();
    const cityLower = center.city.toLowerCase();

    links.forEach((linkData) => {
      const { url, text } = linkData;
      const textLower = text.toLowerCase();

      // Skip irrelevant domains
      if (this.isIrrelevantDomain(url)) {
        return;
      }

      // Prefer exact business name matches
      let relevanceScore = 0;

      if (textLower.includes(centerNameLower)) {
        relevanceScore += 50;
      }

      if (textLower.includes(cityLower)) {
        relevanceScore += 20;
      }

      // Look for electronics/recycling related text
      const hasElectronicsKeywords = RECYCLING_KEYWORDS.some((keyword) =>
        textLower.includes(keyword.toLowerCase())
      );

      if (hasElectronicsKeywords) {
        relevanceScore += 30;
      }

      // Only include if it has some relevance
      if (relevanceScore >= 20 || textLower.includes(centerNameLower)) {
        businessUrls.push({
          url: this.normalizeUrl(url),
          text,
          relevanceScore,
        });
      }
    });

    // Sort by relevance score
    return businessUrls
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);
  }

  isIrrelevantDomain(url) {
    const irrelevantDomains = [
      'facebook.com/pages',
      'twitter.com',
      'instagram.com',
      'linkedin.com',
      'youtube.com',
      'maps.google.com',
      'yelp.com',
      'yellowpages.com',
      'bbb.org',
      'foursquare.com',
      'wikipedia.org',
      'reddit.com',
    ];

    return irrelevantDomains.some((domain) => url.includes(domain));
  }

  isValidBusinessUrl(url) {
    try {
      const urlObj = new URL(url);

      // Skip social media and directory sites
      const skipDomains = [
        'facebook.com',
        'twitter.com',
        'instagram.com',
        'linkedin.com',
        'yelp.com',
        'yellowpages.com',
        'maps.google.com',
      ];

      return !skipDomains.some((domain) => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  normalizeUrl(url) {
    try {
      // Handle relative URLs
      if (url.startsWith('/')) {
        return url; // Return as-is, will need base URL context
      }

      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      const urlObj = new URL(url);
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  selectBestWebsite(urls, center) {
    if (urls.length === 0) return null;
    if (urls.length === 1) return urls[0];

    // Score URLs based on various factors
    const scoredUrls = urls.map((url) => {
      let score = 0;
      const domain = new URL(url).hostname.toLowerCase();
      const centerNameParts = center.name.toLowerCase().split(' ');

      // Prefer URLs that include business name in domain
      centerNameParts.forEach((part) => {
        if (part.length > 3 && domain.includes(part)) {
          score += 20;
        }
      });

      // Prefer .com domains
      if (domain.endsWith('.com')) {
        score += 10;
      }

      // Prefer shorter, cleaner domains
      if (domain.split('.').length === 2) {
        score += 5;
      }

      return { url, score };
    });

    // Return the highest scoring URL
    scoredUrls.sort((a, b) => b.score - a.score);
    return scoredUrls[0].url;
  }

  async scrapeWebsiteContent(url) {
    const page = await this.browser.newPage();

    try {
      await page.setUserAgent(CONFIG.USER_AGENT);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.TIMEOUT,
      });

      // Extract page content for analysis
      const scrapedData = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach((el) => el.remove());

        return {
          title: document.title || '',
          metaDescription:
            document.querySelector('meta[name="description"]')?.content || '',
          content: document.body?.innerText?.substring(0, 5000) || '', // Limit content length
          url: window.location.href,
        };
      });

      return {
        success: true,
        ...scrapedData,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        url,
      };
    } finally {
      await page.close();
    }
  }

  analyzeBusinessLegitimacy(scrapedData, center) {
    const allText =
      `${scrapedData.title} ${scrapedData.metaDescription} ${scrapedData.content}`.toLowerCase();

    // Count electronics/recycling-related keywords with weighted scoring
    let recyclingScore = 0;
    const keywordMatches = [];

    // High-value keywords (specific to e-waste/recycling)
    const highValueKeywords = [
      'e-waste',
      'electronic waste',
      'electronics recycling',
      'r2 certified',
      'e-stewards',
      'data destruction',
      'certified recycler',
    ];

    const mediumValueKeywords = [
      'recycle',
      'recycling',
      'electronics',
      'computers',
      'waste management',
    ];

    highValueKeywords.forEach((keyword) => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      if (matches > 0) {
        recyclingScore += matches * 5; // High value
        keywordMatches.push(`${keyword} (${matches}x)`);
      }
    });

    mediumValueKeywords.forEach((keyword) => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      if (matches > 0) {
        recyclingScore += matches * 2; // Medium value
        keywordMatches.push(`${keyword} (${matches}x)`);
      }
    });

    // Count remaining keywords with standard scoring
    const otherKeywords = RECYCLING_KEYWORDS.filter(
      (k) => !highValueKeywords.includes(k) && !mediumValueKeywords.includes(k)
    );

    otherKeywords.forEach((keyword) => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      if (matches > 0) {
        recyclingScore += matches; // Standard value
        keywordMatches.push(`${keyword} (${matches}x)`);
      }
    });

    // Count red flag keywords
    const redFlagMatches = [];
    let redFlagScore = 0;
    RED_FLAG_KEYWORDS.forEach((keyword) => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      if (matches > 0) {
        redFlagScore += matches;
        redFlagMatches.push(`${keyword} (${matches}x)`);
      }
    });

    // Calculate legitimacy score
    let legitimacyScore = 0;
    let legitimacyReason = [];

    // Enhanced scoring based on recycling content
    if (recyclingScore >= 15) {
      legitimacyScore += 80;
      legitimacyReason.push(
        `Very strong e-waste content (${recyclingScore} points)`
      );
    } else if (recyclingScore >= 8) {
      legitimacyScore += 60;
      legitimacyReason.push(
        `Strong e-waste content (${recyclingScore} points)`
      );
    } else if (recyclingScore >= 4) {
      legitimacyScore += 40;
      legitimacyReason.push(
        `Moderate e-waste content (${recyclingScore} points)`
      );
    } else if (recyclingScore >= 1) {
      legitimacyScore += 20;
      legitimacyReason.push(`Some e-waste content (${recyclingScore} points)`);
    } else {
      legitimacyScore -= 20;
      legitimacyReason.push('No clear e-waste/recycling content found');
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

    // Check for common electronics businesses
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

    // Red flags penalty
    if (redFlagScore > 0) {
      legitimacyScore -= redFlagScore * 15;
      legitimacyReason.push(`Red flag keywords: ${redFlagMatches.join(', ')}`);
    }

    const isLegitimate = legitimacyScore >= 25;
    const isSuspicious = legitimacyScore < -10;

    return {
      legitimacyScore,
      legitimacyReason: legitimacyReason.join('; '),
      isLegitimate,
      isSuspicious,
      recyclingKeywords: keywordMatches.slice(0, 10),
      redFlagKeywords: redFlagMatches,
      recyclingScore,
      redFlagScore,
    };
  }

  async processBatch(centers) {
    const batchResults = [];

    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      this.progress.processed++;

      console.log(
        `\n🔍 [${this.progress.processed}/${this.progress.total}] Searching for: ${center.name}`
      );
      console.log(`   📍 Location: ${center.city}, ${center.state}`);
      console.log(
        `   📊 Priority Score: ${center.priorityScore}, Legitimacy: ${center.legitimacyScore}`
      );

      try {
        const result = await this.searchAlternativeSources(center);
        batchResults.push(result);

        // Store in results map to prevent duplicates
        this.results.set(center.id, result);

        if (result.success) {
          this.progress.websitesFound++;
          console.log(
            `   ✅ Found ${result.websitesFound.length} potential websites`
          );

          if (result.bestWebsite) {
            console.log(`   🎯 Best website: ${result.bestWebsite}`);

            if (result.legitimacyAnalysis) {
              const legitStatus = result.isLegitimate
                ? '✅ Legitimate'
                : result.isSuspicious
                ? '🚨 Suspicious'
                : '❓ Uncertain';
              console.log(
                `   ${legitStatus} (score: ${result.finalLegitimacyScore})`
              );
            }
          }
        } else {
          console.log(`   ❌ No websites found through alternative sources`);
        }
      } catch (error) {
        console.log(`   ❌ Error processing center: ${error.message}`);
        this.progress.errors.push({
          centerId: center.id,
          centerName: center.name,
          error: error.message,
          timestamp: new Date().toISOString(),
        });

        batchResults.push({
          centerId: center.id,
          centerName: center.name,
          success: false,
          error: error.message,
          searchedAt: new Date().toISOString(),
        });
      }

      // Save progress every few centers
      if (this.progress.processed % 5 === 0) {
        await this.saveProgress();
        await this.saveResults(Array.from(this.results.values()));
      }

      // Delay between centers
      if (i < centers.length - 1) {
        await this.delay(CONFIG.DELAY_BETWEEN_REQUESTS);
      }
    }

    return batchResults;
  }

  async saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `final_scraping_results_${this.progress.phase}_${timestamp}.json`;
    const filePath = path.join(CONFIG.OUTPUT_DIR, fileName);

    await fs.writeFile(filePath, JSON.stringify(results, null, 2));

    // Also save a summary CSV
    const csvFileName = `final_scraping_summary_${this.progress.phase}_${timestamp}.csv`;
    const csvPath = path.join(CONFIG.OUTPUT_DIR, csvFileName);

    const csvRows = results
      .filter((r) => r.success && r.bestWebsite)
      .map((result) => {
        const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;

        return [
          result.centerId,
          escapeCsv(result.centerName),
          result.city,
          result.state,
          result.bestWebsite,
          result.websitesFound.length,
          result.finalLegitimacyScore || 'N/A',
          result.isLegitimate ? 'Yes' : 'No',
          result.isSuspicious ? 'Yes' : 'No',
          escapeCsv(result.legitimacyAnalysis?.legitimacyReason || ''),
          result.phone || '',
        ].join(',');
      });

    const csvContent = [
      'Center ID,Name,City,State,Website Found,Total URLs Found,Legitimacy Score,Is Legitimate,Is Suspicious,Legitimacy Reason,Phone',
      ...csvRows,
    ].join('\n');

    await fs.writeFile(csvPath, csvContent);

    console.log(`💾 Results saved to: ${fileName}`);
  }

  async processPhase(phase) {
    console.log(`\n🎯 Starting ${phase} processing...`);

    this.progress.phase = phase;
    this.progress.startedAt = new Date().toISOString();

    // Load target centers for this phase
    const centers = await this.loadPhaseTargets(phase);
    this.progress.total = centers.length;

    // Filter out already processed centers if resuming
    const centersToProcess = centers.slice(this.progress.processed);

    if (centersToProcess.length === 0) {
      console.log(`✅ ${phase} already completed!`);
      return;
    }

    console.log(
      `📋 Processing ${centersToProcess.length} centers in batches of ${CONFIG.BATCH_SIZE}...`
    );

    // Process in batches
    for (let i = 0; i < centersToProcess.length; i += CONFIG.BATCH_SIZE) {
      const batch = centersToProcess.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(
        `\n📦 Processing batch ${
          Math.floor(i / CONFIG.BATCH_SIZE) + 1
        }/${Math.ceil(centersToProcess.length / CONFIG.BATCH_SIZE)}...`
      );

      await this.processBatch(batch);

      // Delay between batches
      if (i + CONFIG.BATCH_SIZE < centersToProcess.length) {
        console.log(
          `⏸️ Waiting ${CONFIG.DELAY_BETWEEN_REQUESTS}ms before next batch...`
        );
        await this.delay(CONFIG.DELAY_BETWEEN_REQUESTS);
      }
    }

    // Save final results
    await this.saveResults(Array.from(this.results.values()));
    await this.saveProgress();

    console.log(`\n✅ ${phase} processing completed!`);
    console.log(
      `📊 Summary: ${this.progress.websitesFound} websites found from ${this.progress.processed} centers`
    );
  }

  async generateFinalReport() {
    console.log('\n📋 Generating final comprehensive report...');

    const allResults = Array.from(this.results.values());
    const successful = allResults.filter((r) => r.success && r.bestWebsite);
    const legitimate = successful.filter((r) => r.isLegitimate);
    const suspicious = successful.filter((r) => r.isSuspicious);

    const report = {
      summary: {
        totalCentersProcessed: allResults.length,
        websitesFound: successful.length,
        legitimateBusinesses: legitimate.length,
        suspiciousBusinesses: suspicious.length,
        successRate:
          ((successful.length / allResults.length) * 100).toFixed(1) + '%',
        legitimacyRate:
          successful.length > 0
            ? ((legitimate.length / successful.length) * 100).toFixed(1) + '%'
            : '0%',
      },
      phase: this.progress.phase,
      completedAt: new Date().toISOString(),
      processingTime: this.progress.startedAt
        ? (
            (new Date() - new Date(this.progress.startedAt)) /
            1000 /
            60
          ).toFixed(1) + ' minutes'
        : 'Unknown',
      errors: this.progress.errors,
      newWebsites: successful.map((r) => ({
        centerId: r.centerId,
        centerName: r.centerName,
        location: `${r.city}, ${r.state}`,
        website: r.bestWebsite,
        legitimacyScore: r.finalLegitimacyScore,
        isLegitimate: r.isLegitimate,
        sourcesChecked: Object.keys(r.sources).length,
      })),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(
      CONFIG.OUTPUT_DIR,
      `final_report_${this.progress.phase}_${timestamp}.json`
    );
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 FINAL REPORT - ${this.progress.phase.toUpperCase()}`);
    console.log(`==================================`);
    console.log(
      `📋 Centers Processed: ${report.summary.totalCentersProcessed}`
    );
    console.log(`🌐 Websites Found: ${report.summary.websitesFound}`);
    console.log(
      `✅ Legitimate Businesses: ${report.summary.legitimateBusinesses}`
    );
    console.log(
      `🚨 Suspicious Businesses: ${report.summary.suspiciousBusinesses}`
    );
    console.log(`📈 Success Rate: ${report.summary.successRate}`);
    console.log(`🎯 Legitimacy Rate: ${report.summary.legitimacyRate}`);
    console.log(`⏱️ Processing Time: ${report.processingTime}`);
    console.log(`❌ Errors: ${this.progress.errors.length}`);
    console.log(`\n📁 Full report saved to: ${reportPath}`);

    return report;
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run(phases = ['phase1']) {
    try {
      await this.initialize();

      for (const phase of phases) {
        await this.processPhase(phase);

        // Reset progress for next phase
        this.progress.processed = 0;
        this.progress.websitesFound = 0;
        this.results.clear();

        // Generate report for this phase
        await this.generateFinalReport();

        // Small break between phases
        if (phases.indexOf(phase) < phases.length - 1) {
          console.log('\n⏸️ Taking a 30-second break before next phase...');
          await this.delay(30000);
        }
      }

      console.log('\n🎉 All phases completed successfully!');
    } catch (error) {
      console.error('❌ Fatal error:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
async function main() {
  const scraper = new AlternativeSourceScraper();

  // Get phases from command line arguments or default to phase1
  const phases = process.argv.slice(2);
  const validPhases = ['phase1', 'phase2', 'phase3'];
  const phasesToRun =
    phases.length > 0 && phases.every((p) => validPhases.includes(p))
      ? phases
      : ['phase1'];

  console.log(
    `🚀 Starting final alternative source scraping for: ${phasesToRun.join(
      ', '
    )}`
  );

  try {
    await scraper.run(phasesToRun);
  } catch (error) {
    console.error('💥 Scraper failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Graceful shutdown requested...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled rejection:', error);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
