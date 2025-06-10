import { createClient } from '@supabase/supabase-js';
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

// Check for Google Places API key
const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!googleApiKey) {
  console.error(
    '❌ Missing Google Places API key. Please set GOOGLE_PLACES_API_KEY environment variable'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const CONFIG = {
  BATCH_SIZE: 10, // Process 10 centers at a time
  DELAY_BETWEEN_REQUESTS: 1000, // 1 second between requests (Google API rate limiting)
  MAX_RETRIES: 3,
  OUTPUT_DIR: './data/places_research',
  PROGRESS_FILE: './data/places_research_progress.json',
  GOOGLE_API_KEY: googleApiKey,
};

// Keywords to identify businesses that offer electronics recycling services
const RECYCLING_KEYWORDS = [
  // Direct recycling terms
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
  'e-stewards',
  'iso 14001',
  'responsible recycling',
  'waste management',
  'environmental services',
  'sustainability',

  // Electronic device types
  'electronics',
  'computers',
  'laptops',
  'desktops',
  'tablets',
  'smartphones',
  'cell phones',
  'mobile phones',
  'televisions',
  'monitors',
  'printers',
  'ink cartridges',
  'toner cartridges',
  'batteries',
  'crt monitors',
  'lcd monitors',
  'led monitors',
  'hard drives',
  'motherboards',
  'cables',
  'chargers',
  'power adapters',
  'keyboards',
  'mice',
  'speakers',
  'headphones',

  // Services offered
  'phone repair',
  'computer repair',
  'electronics repair',
  'data destruction',
  'hard drive destruction',
  'secure data wiping',
  'trade-in',
  'trade in',
  'buy back',
  'buyback',
  'drop off',
  'drop-off',
  'collection',
  'pickup',
  'disposal',
  'take back',
  'takeback',
  'refurbished',
  'refurbishment',
  'reuse',

  // Business types
  'office supplies',
  'electronics store',
  'computer store',
  'tech support',
  'it services',
  'technology solutions',
  'green solutions',
  'eco-friendly',
  'environmentally responsible',

  // Certifications and compliance
  'hipaa compliant',
  'certified destruction',
  'chain of custody',
  'certificate of destruction',
  'compliance',
  'audit trail',
];

// Red flag keywords for businesses unlikely to offer electronics recycling
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

class GooglePlacesResearcher {
  constructor() {
    this.progress = { processed: 0, total: 0, errors: [], found_websites: 0 };
    this.results = [];
  }

  async initialize() {
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
      console.log('Starting fresh Google Places research session');
    }
  }

  async saveProgress() {
    await fs.writeFile(
      CONFIG.PROGRESS_FILE,
      JSON.stringify(this.progress, null, 2)
    );
  }

  async getCentersToResearch() {
    // Get centers WITHOUT websites AND centers that FAILED to be scraped
    console.log('Fetching recycling centers for Google Places research...');

    // First, get centers with no websites (original behavior)
    const centersWithoutWebsites = await this.getCentersWithoutWebsites();
    console.log(
      `Found ${centersWithoutWebsites.length} centers with no websites`
    );

    // Second, get centers that failed to be scraped
    const failedScrapingCenters = await this.getFailedScrapingCenters();
    console.log(
      `Found ${failedScrapingCenters.length} centers that failed to be scraped`
    );

    // Combine and deduplicate
    const allCenters = [...centersWithoutWebsites, ...failedScrapingCenters];
    const uniqueCenters = this.deduplicateCenters(allCenters);

    console.log(
      `Total unique centers for Google Places research: ${uniqueCenters.length}`
    );
    this.progress.total = uniqueCenters.length;

    // Skip already processed centers
    const remainingCenters = uniqueCenters.slice(this.progress.processed);
    console.log(`${remainingCenters.length} centers remaining to research`);

    return remainingCenters;
  }

  async getCentersWithoutWebsites() {
    // Get all centers WITHOUT websites using pagination
    const PAGE_SIZE = 1000;
    let allCenters = [];
    let currentPage = 0;
    let hasMore = true;

    console.log('Fetching centers without websites...');

    while (hasMore) {
      const startIndex = currentPage * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE - 1;

      const { data: centers, error } = await supabase
        .from('recycling_centers')
        .select('id, name, city, state, description, phone, full_address')
        .or('site.is.null,site.eq.')
        .order('state', { ascending: true })
        .order('city', { ascending: true })
        .range(startIndex, endIndex);

      if (error) {
        throw new Error(
          `Error fetching centers without websites (page ${currentPage + 1}): ${
            error.message
          }`
        );
      }

      if (centers && centers.length > 0) {
        allCenters = allCenters.concat(centers);
        hasMore = centers.length === PAGE_SIZE;
        currentPage++;
      } else {
        hasMore = false;
      }
    }

    return allCenters;
  }

  async getFailedScrapingCenters() {
    console.log('Analyzing scraping results to find failed centers...');

    // Get all failed center IDs from scraping results
    const failedCenterIds = await this.getFailedCenterIds();

    if (failedCenterIds.length === 0) {
      console.log('No failed scraping centers found');
      return [];
    }

    console.log(
      `Found ${failedCenterIds.length} centers that failed to be scraped`
    );

    // Fetch these centers from database in batches (Supabase has query limits)
    const batchSize = 100; // Reduced to avoid URI too large errors
    let allFailedCenters = [];

    for (let i = 0; i < failedCenterIds.length; i += batchSize) {
      const batch = failedCenterIds.slice(i, i + batchSize);

      const { data: centers, error } = await supabase
        .from('recycling_centers')
        .select('id, name, city, state, description, phone, full_address, site')
        .in('id', batch)
        .order('state', { ascending: true })
        .order('city', { ascending: true });

      if (error) {
        console.error(`Error fetching failed centers batch: ${error.message}`);
        continue;
      }

      if (centers) {
        allFailedCenters = allFailedCenters.concat(centers);
      }
    }

    console.log(
      `Retrieved ${allFailedCenters.length} failed centers from database`
    );
    return allFailedCenters;
  }

  async getFailedCenterIds() {
    const failedIds = new Set();
    const dataDir = './data/scraped_data';

    try {
      const files = await fs.readdir(dataDir);

      // Process both original and retry result files
      const resultFiles = files.filter(
        (file) =>
          (file.startsWith('scraping_results_') ||
            file.startsWith('retry_results_')) &&
          file.endsWith('.json')
      );

      console.log(
        `Analyzing ${resultFiles.length} result files for failures...`
      );

      for (const file of resultFiles) {
        const filePath = path.join(dataDir, file);
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const results = JSON.parse(data);

          // Find failed entries (success: false)
          const failed = results.filter((result) => result.success === false);

          for (const failedResult of failed) {
            failedIds.add(failedResult.centerId);
          }
        } catch (error) {
          console.warn(`⚠️  Could not parse ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Error reading results directory: ${error.message}`);
      return [];
    }

    return Array.from(failedIds);
  }

  deduplicateCenters(centers) {
    const seen = new Set();
    const unique = [];

    for (const center of centers) {
      if (!seen.has(center.id)) {
        seen.add(center.id);
        unique.push(center);
      }
    }

    return unique;
  }

  async searchGooglePlaces(center) {
    try {
      // Construct search query - use more specific terms for failed scraping centers
      let query;
      if (center.site) {
        // This center has a website but scraping failed - search more specifically
        query = `${center.name} electronics recycling ${center.city} ${center.state}`;
      } else {
        // This center has no website - broader search
        query = `${center.name} ${center.city} ${center.state}`;
      }

      const encodedQuery = encodeURIComponent(query);

      // First, search for the place to get place_id
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${CONFIG.GOOGLE_API_KEY}`;

      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (searchData.status !== 'OK' || !searchData.results.length) {
        return {
          success: false,
          error: `No results found for: ${query}`,
          searchedAt: new Date().toISOString(),
          hasExistingWebsite: !!center.site,
          existingWebsite: center.site || null,
        };
      }

      // Get the first (best) result
      const place = searchData.results[0];

      // Get detailed information using place_id
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_phone_number,rating,user_ratings_total,types,opening_hours,reviews,formatted_address&key=${CONFIG.GOOGLE_API_KEY}`;

      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();

      if (detailsData.status !== 'OK') {
        return {
          success: false,
          error: `Details lookup failed: ${detailsData.status}`,
          searchedAt: new Date().toISOString(),
          hasExistingWebsite: !!center.site,
          existingWebsite: center.site || null,
        };
      }

      const details = detailsData.result;

      // Extract and compile review text for content analysis
      const reviewText = details.reviews
        ? details.reviews.map((review) => review.text).join(' ')
        : '';

      return {
        success: true,
        name: details.name,
        website: details.website || null,
        phone: details.formatted_phone_number || null,
        rating: details.rating || null,
        reviewCount: details.user_ratings_total || 0,
        businessTypes: details.types || [],
        address: details.formatted_address || null,
        hours: details.opening_hours?.weekday_text || null,
        reviewContent: reviewText.substring(0, 2000), // Limit content length
        confidence: this.calculateMatchConfidence(center, details),
        searchedAt: new Date().toISOString(),
        hasExistingWebsite: !!center.site,
        existingWebsite: center.site || null,
        // Compare found website with existing website for failed scraping centers
        websiteMatches:
          center.site && details.website
            ? this.compareWebsites(center.site, details.website)
            : null,
      };
    } catch (error) {
      console.error(
        `Error searching Google Places for ${center.name}:`,
        error.message
      );
      return {
        success: false,
        error: error.message,
        searchedAt: new Date().toISOString(),
        hasExistingWebsite: !!center.site,
        existingWebsite: center.site || null,
      };
    }
  }

  compareWebsites(existingUrl, foundUrl) {
    if (!existingUrl || !foundUrl) return false;

    // Normalize URLs for comparison
    const normalize = (url) => {
      return url
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
    };

    const normalizedExisting = normalize(existingUrl);
    const normalizedFound = normalize(foundUrl);

    // Check for exact match or subdomain match
    return (
      normalizedExisting === normalizedFound ||
      normalizedExisting.includes(normalizedFound) ||
      normalizedFound.includes(normalizedExisting)
    );
  }

  calculateMatchConfidence(originalCenter, placesResult) {
    let confidence = 0;

    // Name similarity (basic check)
    const originalName = originalCenter.name.toLowerCase();
    const placesName = placesResult.name.toLowerCase();

    if (
      placesName.includes(originalName) ||
      originalName.includes(placesName)
    ) {
      confidence += 50;
    }

    // Business types that suggest electronics/recycling
    const relevantTypes = [
      'electronics_store',
      'store',
      'establishment',
      'point_of_interest',
    ];
    if (placesResult.types.some((type) => relevantTypes.includes(type))) {
      confidence += 20;
    }

    // Has website (good sign)
    if (placesResult.website) {
      confidence += 15;
    }

    // Has reviews (indicates active business)
    if (placesResult.user_ratings_total > 5) {
      confidence += 10;
    }

    // Good rating
    if (placesResult.rating >= 4.0) {
      confidence += 5;
    }

    return Math.min(confidence, 100); // Cap at 100%
  }

  analyzeBusinessLegitimacy(placesData, center) {
    // Combine all available text for analysis
    const allText = `${placesData.name} ${
      placesData.reviewContent
    } ${placesData.businessTypes.join(' ')}`.toLowerCase();

    // Count electronics/recycling-related keywords with weighted scoring
    const keywordMatches = [];
    let recyclingScore = 0;

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

    // Determine legitimacy
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

    // Business type analysis
    const relevantBusinessTypes = [
      'electronics_store',
      'store',
      'establishment',
    ];
    const irrelevantTypes = [
      'restaurant',
      'food',
      'gas_station',
      'lodging',
      'bank',
      'hospital',
    ];

    if (placesData.businessTypes.includes('electronics_store')) {
      legitimacyScore += 40;
      legitimacyReason.push('Listed as electronics store');
    } else if (
      placesData.businessTypes.some((type) =>
        relevantBusinessTypes.includes(type)
      )
    ) {
      legitimacyScore += 15;
      legitimacyReason.push('Compatible business type');
    } else if (
      placesData.businessTypes.some((type) => irrelevantTypes.includes(type))
    ) {
      legitimacyScore -= 30;
      legitimacyReason.push('Incompatible business type detected');
    }

    // Red flags penalty (more severe)
    if (redFlagScore > 0) {
      legitimacyScore -= redFlagScore * 20;
      legitimacyReason.push(`Red flag keywords: ${redFlagMatches.join(', ')}`);
    }

    // Website verification for failed scraping cases
    if (center.site && placesData.website && !placesData.websiteMatches) {
      legitimacyScore -= 10; // Slight penalty for website mismatch - needs manual review
      legitimacyReason.push(
        'Website differs from database - needs verification'
      );
    }

    // High confidence bonus
    if (placesData.confidence >= 80) {
      legitimacyScore += 15;
      legitimacyReason.push('High confidence match');
    } else if (placesData.confidence < 50) {
      legitimacyScore -= 10;
      legitimacyReason.push('Low confidence match');
    }

    // Rating and review analysis
    if (placesData.rating >= 4.0 && placesData.reviewCount >= 10) {
      legitimacyScore += 10;
      legitimacyReason.push('Good ratings with sufficient reviews');
    }

    const isLegitimate = legitimacyScore >= 30;
    const isSuspicious = legitimacyScore < -10;
    const needsManualReview =
      (center.site && placesData.website && !placesData.websiteMatches) || // Different website found
      (recyclingScore === 0 && redFlagScore === 0) || // No clear indicators either way
      (legitimacyScore >= -10 && legitimacyScore < 30); // Borderline cases

    return {
      legitimacyScore,
      legitimacyReason: legitimacyReason.join('; '),
      isLegitimate,
      isSuspicious,
      needsManualReview,
      recyclingKeywords: keywordMatches.slice(0, 10), // Limit for readability
      redFlagKeywords: redFlagMatches,
      recyclingScore,
      redFlagScore,
    };
  }

  generateDescription(placesData, center) {
    // Prioritize sources for description
    if (placesData.reviewContent && placesData.reviewContent.length > 50) {
      // Extract relevant sentences from reviews
      const sentences = placesData.reviewContent.split(/[.!?]+/);
      const relevantSentences = sentences.filter((sentence) =>
        RECYCLING_KEYWORDS.some((keyword) =>
          sentence.toLowerCase().includes(keyword)
        )
      );

      if (relevantSentences.length > 0) {
        return relevantSentences[0].trim().substring(0, 200) + '.';
      }
    }

    // Fallback: Generate description from business types and name
    const businessType = placesData.businessTypes.includes('electronics_store')
      ? 'Electronics store'
      : 'Business';

    return `${businessType} that may offer electronics recycling services. Located in ${center.city}, ${center.state}.`;
  }

  async processBatch(centers) {
    const batchResults = [];
    console.log(`\n🔍 Processing batch of ${centers.length} centers...`);

    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      const centerType = center.site ? 'Failed Scraping' : 'No Website';

      console.log(
        `   ${i + 1}/${centers.length}: [${centerType}] ${center.name} in ${
          center.city
        }, ${center.state}${center.site ? ` (existing: ${center.site})` : ''}`
      );

      try {
        // Search Google Places
        const placesData = await this.searchGooglePlaces(center);

        let result = {
          centerId: center.id,
          centerName: center.name,
          city: center.city,
          state: center.state,
          existingDescription: center.description,
          centerType: centerType, // Track which type of center this is
          ...placesData,
        };

        if (placesData.success) {
          // Analyze legitimacy
          const legitimacy = this.analyzeBusinessLegitimacy(placesData, center);

          // Generate description
          const suggestedDescription = this.generateDescription(
            placesData,
            center
          );

          result = {
            ...result,
            ...legitimacy,
            suggestedDescription,
          };

          // Enhanced logging for different center types
          if (center.site) {
            // Failed scraping center
            if (placesData.website) {
              if (placesData.websiteMatches) {
                console.log(
                  `   ✅ Confirmed existing website: ${placesData.website}`
                );
              } else {
                console.log(
                  `   🔄 Found different website: ${placesData.website} (was: ${center.site})`
                );
              }
            } else {
              console.log(
                `   ❓ No website found via Google Places (existing: ${center.site})`
              );
            }
          } else {
            // No website center
            if (placesData.website) {
              this.progress.found_websites++;
              console.log(
                `   ✅ Discovered new website: ${placesData.website}`
              );
            } else {
              console.log(`   ❌ No website found`);
            }
          }

          // Track additional contact info found
          if (placesData.phone && placesData.phone !== center.phone) {
            console.log(`   📞 Found phone: ${placesData.phone}`);
          }

          // Track business verification status
          if (legitimacy.isSuspicious) {
            console.log(
              `   🚨 Flagged as suspicious: ${legitimacy.legitimacyReason}`
            );
          } else if (legitimacy.needsManualReview) {
            console.log(
              `   👀 Flagged for manual review: ${legitimacy.legitimacyReason}`
            );
          } else if (legitimacy.isLegitimate) {
            console.log(
              `   ✅ Verified as legitimate e-waste recycler (score: ${legitimacy.legitimacyScore})`
            );
          } else {
            console.log(
              `   ❓ Uncertain legitimacy (score: ${legitimacy.legitimacyScore})`
            );
          }

          // Log key verification details
          if (legitimacy.recyclingKeywords.length > 0) {
            console.log(
              `   🔍 E-waste keywords found: ${legitimacy.recyclingKeywords
                .slice(0, 3)
                .join(', ')}${
                legitimacy.recyclingKeywords.length > 3 ? '...' : ''
              }`
            );
          }
          if (legitimacy.redFlagKeywords.length > 0) {
            console.log(
              `   🚩 Red flags: ${legitimacy.redFlagKeywords
                .slice(0, 3)
                .join(', ')}`
            );
          }
        } else {
          console.log(`   ❌ ${placesData.error}`);
        }

        batchResults.push(result);
      } catch (error) {
        console.error(`   ❌ Error processing ${center.name}:`, error.message);

        const errorResult = {
          centerId: center.id,
          centerName: center.name,
          city: center.city,
          state: center.state,
          existingDescription: center.description,
          centerType: centerType,
          success: false,
          error: error.message,
          searchedAt: new Date().toISOString(),
          hasExistingWebsite: !!center.site,
          existingWebsite: center.site || null,
        };

        batchResults.push(errorResult);
        this.progress.errors.push({
          id: center.id,
          name: center.name,
          error: error.message,
          type: centerType,
        });
      }

      // Update progress
      this.progress.processed++;

      // Delay between requests to respect API rate limits
      if (i < centers.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS)
        );
      }
    }

    return batchResults;
  }

  async saveResults(batchResults) {
    // Save batch results to timestamped file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `places_research_${timestamp}.json`;
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(batchResults, null, 2));
    console.log(`💾 Saved ${batchResults.length} results to ${filename}`);

    // Update progress file
    await this.saveProgress();
  }

  async run() {
    console.log(
      '🚀 Starting Google Places research for recycling centers without websites...\n'
    );

    try {
      await this.initialize();
      const centersToResearch = await this.getCentersToResearch();

      if (centersToResearch.length === 0) {
        console.log('✅ All centers have been researched!');
        await this.generateSummaryReport();
        return;
      }

      console.log(`📊 Research Summary:`);
      console.log(`   Total centers without websites: ${this.progress.total}`);
      console.log(`   Already researched: ${this.progress.processed}`);
      console.log(`   Remaining to research: ${centersToResearch.length}`);
      console.log(`   Websites found so far: ${this.progress.found_websites}`);
      console.log(`   Errors so far: ${this.progress.errors.length}\n`);

      // Process in batches
      for (let i = 0; i < centersToResearch.length; i += CONFIG.BATCH_SIZE) {
        const batch = centersToResearch.slice(i, i + CONFIG.BATCH_SIZE);
        const batchNumber =
          Math.floor(this.progress.processed / CONFIG.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(this.progress.total / CONFIG.BATCH_SIZE);

        console.log(`\n📦 Batch ${batchNumber}/${totalBatches}`);

        const batchResults = await this.processBatch(batch);
        await this.saveResults(batchResults);

        console.log(`✅ Batch ${batchNumber} complete`);
        console.log(
          `📈 Progress: ${this.progress.processed}/${this.progress.total} (${(
            (this.progress.processed / this.progress.total) *
            100
          ).toFixed(1)}%)`
        );
        console.log(`🌐 Websites found: ${this.progress.found_websites}`);
      }

      console.log('\n🎉 Google Places research completed!');
      await this.generateSummaryReport();
    } catch (error) {
      console.error('💥 Fatal error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }

  async generateSummaryReport() {
    // Compile results from all files to generate comprehensive stats
    const allResults = await this.compileAllResults();

    const centersWithoutWebsites = allResults.filter(
      (r) => !r.hasExistingWebsite
    );
    const failedScrapingCenters = allResults.filter(
      (r) => r.hasExistingWebsite
    );

    const newWebsitesFound = centersWithoutWebsites.filter(
      (r) => r.success && r.website
    ).length;
    const alternativeWebsitesFound = failedScrapingCenters.filter(
      (r) => r.success && r.website && !r.websiteMatches
    ).length;
    const confirmedWebsites = failedScrapingCenters.filter(
      (r) => r.success && r.website && r.websiteMatches
    ).length;

    const summary = {
      totalCenters: this.progress.total,
      processedCenters: this.progress.processed,

      // Centers without websites
      centersWithoutWebsites: centersWithoutWebsites.length,
      newWebsitesDiscovered: newWebsitesFound,
      noWebsiteDiscoveryRate:
        centersWithoutWebsites.length > 0
          ? ((newWebsitesFound / centersWithoutWebsites.length) * 100).toFixed(
              1
            ) + '%'
          : '0%',

      // Centers with failed scraping
      failedScrapingCenters: failedScrapingCenters.length,
      alternativeWebsitesFound: alternativeWebsitesFound,
      existingWebsitesConfirmed: confirmedWebsites,

      // Overall stats
      totalWebsitesFound:
        newWebsitesFound + alternativeWebsitesFound + confirmedWebsites,
      totalErrors: this.progress.errors.length,

      // Legitimacy analysis
      legitimateBusinesses: allResults.filter(
        (r) => r.success && r.isLegitimate
      ).length,
      suspiciousBusinesses: allResults.filter(
        (r) => r.success && r.isSuspicious
      ).length,
      needsManualReview: allResults.filter(
        (r) => r.success && r.needsManualReview
      ).length,

      completedAt: new Date().toISOString(),
    };

    const reportPath = path.join(CONFIG.OUTPUT_DIR, 'research_summary.json');
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));

    // Generate separate files for suspicious centers and manual review cases
    await this.generateSuspiciousCentersReport();
    await this.generateManualReviewReport();

    console.log('\n📊 Final Google Places Research Summary:');
    console.log(
      `   Total centers researched: ${summary.processedCenters}/${summary.totalCenters}`
    );
    console.log('\n📋 Centers Without Websites:');
    console.log(`   Processed: ${summary.centersWithoutWebsites}`);
    console.log(
      `   New websites discovered: ${summary.newWebsitesDiscovered} (${summary.noWebsiteDiscoveryRate})`
    );
    console.log('\n🔄 Failed Scraping Centers:');
    console.log(`   Processed: ${summary.failedScrapingCenters}`);
    console.log(
      `   Alternative websites found: ${summary.alternativeWebsitesFound}`
    );
    console.log(
      `   Existing websites confirmed: ${summary.existingWebsitesConfirmed}`
    );
    console.log('\n🎯 Overall Results:');
    console.log(
      `   Total websites found/confirmed: ${summary.totalWebsitesFound}`
    );
    console.log(
      `   Legitimate businesses identified: ${summary.legitimateBusinesses}`
    );
    console.log(
      `   Suspicious businesses flagged: ${summary.suspiciousBusinesses}`
    );
    console.log(
      `   Businesses needing manual review: ${summary.needsManualReview}`
    );
    console.log(`   Errors encountered: ${summary.totalErrors}`);
    console.log(`   Report saved to: ${reportPath}`);
  }

  async compileAllResults() {
    const allResults = [];

    try {
      const files = await fs.readdir(CONFIG.OUTPUT_DIR);
      const resultFiles = files.filter(
        (f) =>
          f.startsWith('places_research_') &&
          f.endsWith('.json') &&
          f !== 'research_summary.json'
      );

      for (const file of resultFiles) {
        const filePath = path.join(CONFIG.OUTPUT_DIR, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const results = JSON.parse(fileContent);
        allResults.push(...results);
      }
    } catch (error) {
      console.log('Could not compile all results for summary');
    }

    return allResults;
  }

  async generateSuspiciousCentersReport() {
    // Get all suspicious centers from all results
    const allResults = [];

    // Read all result files to compile suspicious centers
    try {
      const files = await fs.readdir(CONFIG.OUTPUT_DIR);
      const resultFiles = files.filter(
        (f) =>
          f.startsWith('places_research_') &&
          f.endsWith('.json') &&
          f !== 'research_summary.json'
      );

      for (const file of resultFiles) {
        const filePath = path.join(CONFIG.OUTPUT_DIR, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const results = JSON.parse(fileContent);
        allResults.push(...results);
      }
    } catch (error) {
      console.log('Could not compile results for suspicious centers report');
      return;
    }

    const suspiciousCenters = allResults.filter(
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
      'Center ID,Name,City,State,Website Found,Confidence,Legitimacy Score,Reason,Phone,Existing Description\n';
    const csvRows = suspiciousCenters.map((center) => {
      const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;

      return [
        center.centerId,
        escapeCsv(center.centerName),
        center.city,
        center.state,
        center.website || 'Not Found',
        center.confidence || 'N/A',
        center.legitimacyScore,
        escapeCsv(center.legitimacyReason),
        center.phone || '',
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

  async generateManualReviewReport() {
    // Get all centers needing manual review from all results
    const allResults = [];

    try {
      const files = await fs.readdir(CONFIG.OUTPUT_DIR);
      const resultFiles = files.filter(
        (f) =>
          f.startsWith('places_research_') &&
          f.endsWith('.json') &&
          f !== 'research_summary.json'
      );

      for (const file of resultFiles) {
        const filePath = path.join(CONFIG.OUTPUT_DIR, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const results = JSON.parse(fileContent);
        allResults.push(...results);
      }
    } catch (error) {
      console.log('Could not compile results for manual review report');
      return;
    }

    const manualReviewCenters = allResults.filter(
      (r) => r.needsManualReview && r.success
    );

    if (manualReviewCenters.length === 0) {
      console.log('No centers need manual review');
      return;
    }

    // Generate JSON file for manual review centers
    const reviewJsonFile = path.join(
      CONFIG.OUTPUT_DIR,
      'manual_review_centers.json'
    );
    await fs.writeFile(
      reviewJsonFile,
      JSON.stringify(manualReviewCenters, null, 2)
    );

    // Generate CSV for easy manual review
    const csvHeaders =
      'Center ID,Name,City,State,Center Type,Website Found,Existing Website,Websites Match,Confidence,Legitimacy Score,Reason,E-waste Keywords,Red Flag Keywords,Phone,Rating,Review Count\n';

    const csvRows = manualReviewCenters.map((center) => {
      const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;

      return [
        center.centerId,
        escapeCsv(center.centerName),
        center.city,
        center.state,
        center.centerType,
        center.website || 'Not Found',
        center.existingWebsite || 'None',
        center.websiteMatches ? 'Yes' : 'No',
        center.confidence || 'N/A',
        center.legitimacyScore,
        escapeCsv(center.legitimacyReason),
        escapeCsv((center.recyclingKeywords || []).join('; ')),
        escapeCsv((center.redFlagKeywords || []).join('; ')),
        center.phone || '',
        center.rating || '',
        center.reviewCount || '',
      ].join(',');
    });

    const csvContent = csvHeaders + csvRows.join('\n');
    const reviewCsvFile = path.join(
      CONFIG.OUTPUT_DIR,
      'manual_review_centers.csv'
    );
    await fs.writeFile(reviewCsvFile, csvContent);

    console.log(`📋 Generated manual review files:`);
    console.log(
      `   JSON: manual_review_centers.json (${manualReviewCenters.length} centers)`
    );
    console.log(
      `   CSV:  manual_review_centers.csv (for detailed spreadsheet review)`
    );
    console.log(
      `\n👀 ${manualReviewCenters.length} centers need manual verification for e-waste recycling services`
    );
  }

  async validateWebsite(url) {
    try {
      const response = await fetch(url, { method: 'HEAD', timeout: 10000 });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Run the researcher
const researcher = new GooglePlacesResearcher();
researcher.run().catch(console.error);
