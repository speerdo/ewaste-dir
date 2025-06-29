#!/usr/bin/env node

/**
 * Update City Populations Script
 *
 * Updates all existing city_stats entries with real population data from Wikipedia
 */

import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const CONFIG = {
  BATCH_SIZE: 5, // Process 5 cities at a time
  DELAY_BETWEEN_REQUESTS: 4000, // 4 seconds between requests
  TIMEOUT: 20000, // 20 second timeout per page
  MAX_RETRIES: 2,
  DELAY_BETWEEN_RETRIES: 8000,
  PROGRESS_FILE: './data/population_update_progress.json',
  USER_AGENT:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
};

class PopulationUpdater {
  constructor() {
    this.browser = null;
    this.progress = {
      processed: 0,
      total: 0,
      successful: 0,
      failed: 0,
      updated: 0,
    };
    this.stats = { totalCities: 0, successfulScrapes: 0, databaseUpdates: 0 };
  }

  async initialize() {
    console.log('🚀 Initializing population updater...');

    // Ensure data directory exists
    try {
      await fs.mkdir('./data', { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
      ],
    });

    await this.loadProgress();
    console.log('✅ Browser initialized');
  }

  async loadProgress() {
    try {
      const progressData = await fs.readFile(CONFIG.PROGRESS_FILE, 'utf-8');
      this.progress = JSON.parse(progressData);
      console.log(`📄 Resuming from city ${this.progress.processed}`);
    } catch (error) {
      console.log('📄 Starting fresh population update session');
    }
  }

  async saveProgress() {
    await fs.writeFile(
      CONFIG.PROGRESS_FILE,
      JSON.stringify(this.progress, null, 2)
    );
  }

  async getCitiesFromDatabase() {
    console.log('🔍 Fetching all cities from city_stats table...');

    let allCities = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: cities, error } = await supabase
        .from('city_stats')
        .select('city_state, population')
        .range(from, from + batchSize - 1);

      if (error) {
        throw new Error(`Error fetching city stats: ${error.message}`);
      }

      if (cities && cities.length > 0) {
        allCities = allCities.concat(cities);
        from += batchSize;
        hasMore = cities.length === batchSize;
        console.log(
          `   Fetched ${cities.length} cities (total: ${allCities.length})`
        );
      } else {
        hasMore = false;
      }
    }

    // Convert to format we need and skip already processed
    const citiesToProcess = allCities
      .slice(this.progress.processed)
      .map((city) => {
        const [cityName, state] = city.city_state.split(', ');
        return {
          city: cityName,
          state: state,
          cityState: city.city_state,
          currentPopulation: city.population,
        };
      });

    this.progress.total = allCities.length;
    this.stats.totalCities = allCities.length;

    console.log(`✅ Found ${allCities.length} total cities in database`);
    console.log(`🔄 Processing ${citiesToProcess.length} remaining cities`);

    return citiesToProcess;
  }

  async scrapePopulationData(city, state) {
    const page = await this.browser.newPage();

    try {
      await page.setUserAgent(CONFIG.USER_AGENT);
      await page.setViewport({ width: 1920, height: 1080 });

      // Block unnecessary resources
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Try different Wikipedia URL formats
      const searchQueries = [
        `${city}, ${state}`,
        `${city} ${state}`,
        `${city} (${state})`,
      ];

      for (const query of searchQueries) {
        try {
          const searchUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(
            query.replace(/ /g, '_')
          )}`;

          await page.goto(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.TIMEOUT,
          });

          // Check if we got a valid city page
          const isValidCityPage = await page.evaluate(() => {
            const infobox = document.querySelector('.infobox, .vcard');
            if (!infobox) return false;

            const pageText = document.body.innerText.toLowerCase();
            return (
              pageText.includes('population') &&
              (pageText.includes('city') ||
                pageText.includes('town') ||
                pageText.includes('municipality'))
            );
          });

          if (!isValidCityPage) {
            continue;
          }

          // Extract population data
          const populationData = await page.evaluate(() => {
            const extractNumberFromText = (text) => {
              if (!text) return null;
              const cleanText = text.replace(/,/g, '').replace(/\s/g, '');
              const match = cleanText.match(/(\d{3,})/);
              return match ? parseInt(match[1]) : null;
            };

            // Look in infobox first
            const infobox = document.querySelector('.infobox, .vcard');
            if (infobox) {
              const rows = infobox.querySelectorAll('tr');
              for (const row of rows) {
                const text = row.innerText.toLowerCase();
                if (text.includes('population') && !text.includes('density')) {
                  const nextRow = row.nextElementSibling;
                  if (nextRow) {
                    const population = extractNumberFromText(nextRow.innerText);
                    if (population) {
                      return { population, source: 'infobox' };
                    }
                  }

                  // Sometimes population is in the same row
                  const population = extractNumberFromText(row.innerText);
                  if (population) {
                    return { population, source: 'infobox' };
                  }
                }
              }
            }

            // Look for demographic section
            const sections = document.querySelectorAll('h2, h3');
            for (const section of sections) {
              const text = section.innerText.toLowerCase();
              if (text.includes('demographic') || text.includes('population')) {
                let current = section.nextElementSibling;
                for (let i = 0; i < 5 && current; i++) {
                  const population = extractNumberFromText(current.innerText);
                  if (population) {
                    return { population, source: 'demographics_section' };
                  }
                  current = current.nextElementSibling;
                }
              }
            }

            return null;
          });

          if (populationData && populationData.population) {
            await page.close();
            return {
              success: true,
              population: populationData.population,
              source: populationData.source,
              url: searchUrl,
            };
          }
        } catch (error) {
          console.log(`   Error with URL ${query}: ${error.message}`);
          continue;
        }
      }

      await page.close();
      return {
        success: false,
        error: 'No population data found on Wikipedia',
      };
    } catch (error) {
      if (!page.isClosed()) {
        await page.close();
      }
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async updateDatabase(cityState, populationData) {
    try {
      const { error } = await supabase
        .from('city_stats')
        .update({
          population: populationData.population,
        })
        .eq('city_state', cityState);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processBatch(cities) {
    const results = [];

    for (const cityData of cities) {
      console.log(
        `🔍 Processing ${cityData.city}, ${cityData.state} (${
          this.progress.processed + 1
        }/${this.progress.total})`
      );

      const result = await this.scrapePopulationData(
        cityData.city,
        cityData.state
      );

      if (result.success) {
        console.log(
          `   ✅ Found population: ${result.population.toLocaleString()}`
        );

        // Update database
        const updateResult = await this.updateDatabase(
          cityData.cityState,
          result
        );

        if (updateResult.success) {
          console.log(`   💾 Database updated successfully`);
          this.progress.successful++;
          this.progress.updated++;
          this.stats.successfulScrapes++;
          this.stats.databaseUpdates++;
        } else {
          console.log(`   ❌ Database update failed: ${updateResult.error}`);
          this.progress.successful++;
          this.stats.successfulScrapes++;
        }
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        this.progress.failed++;
      }

      this.progress.processed++;
      results.push({
        cityState: cityData.cityState,
        ...result,
      });

      // Save progress after each city
      await this.saveProgress();

      // Delay between requests
      await this.delay(CONFIG.DELAY_BETWEEN_REQUESTS);
    }

    return results;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async run() {
    try {
      await this.initialize();

      const cities = await this.getCitiesFromDatabase();

      if (cities.length === 0) {
        console.log('🎉 All cities have been processed!');
        await this.generateSummaryReport();
        return;
      }

      console.log(
        `🚀 Starting population update for ${cities.length} remaining cities...`
      );

      // Process cities in batches
      for (let i = 0; i < cities.length; i += CONFIG.BATCH_SIZE) {
        const batch = cities.slice(i, i + CONFIG.BATCH_SIZE);

        console.log(
          `\n📦 Processing batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1} (${
            batch.length
          } cities)`
        );

        await this.processBatch(batch);

        console.log(
          `✅ Batch complete. Progress: ${this.progress.processed}/${
            this.progress.total
          } (${Math.round(
            (this.progress.processed / this.progress.total) * 100
          )}%)`
        );

        // Small delay between batches
        if (i + CONFIG.BATCH_SIZE < cities.length) {
          await this.delay(2000);
        }
      }

      await this.generateSummaryReport();
      console.log('🎉 Population update complete!');
    } catch (error) {
      console.error('❌ Fatal error:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async generateSummaryReport() {
    const report = {
      completedAt: new Date().toISOString(),
      totalCities: this.stats.totalCities,
      processed: this.progress.processed,
      successful: this.progress.successful,
      failed: this.progress.failed,
      updated: this.progress.updated,
      successRate: Math.round(
        (this.progress.successful / this.progress.processed) * 100
      ),
      updateRate: Math.round(
        (this.progress.updated / this.progress.processed) * 100
      ),
    };

    console.log('\n📊 FINAL SUMMARY:');
    console.log(`   Total cities in database: ${report.totalCities}`);
    console.log(`   Cities processed: ${report.processed}`);
    console.log(`   Successful scrapes: ${report.successful}`);
    console.log(`   Database updates: ${report.updated}`);
    console.log(`   Failed scrapes: ${report.failed}`);
    console.log(`   Success rate: ${report.successRate}%`);
    console.log(`   Update rate: ${report.updateRate}%`);

    await fs.writeFile(
      './data/population_update_summary.json',
      JSON.stringify(report, null, 2)
    );
  }
}

async function main() {
  const updater = new PopulationUpdater();
  await updater.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}
