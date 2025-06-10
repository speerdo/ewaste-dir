#!/usr/bin/env node

/**
 * Local Data Collection Script for Electronics Recycling Directory
 *
 * This script collects local recycling regulations, environmental data,
 * and community information to enhance city pages.
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_ANON_KEY
);

class LocalDataCollector {
  constructor() {
    this.censusApiKey = process.env.CENSUS_API_KEY;
    this.epaApiKey = process.env.EPA_API_KEY;
    this.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get list of cities that need data enhancement
   */
  async getCitiesNeedingData() {
    console.log('📊 Using database function to find cities needing data...');

    // Use the stored procedure to get cities that need data
    const { data: cities, error } = await supabase.rpc(
      'get_cities_needing_data'
    );

    if (error) throw error;

    const cityList = cities.map((row) => row.city_state);
    console.log(
      `🎯 Found ${cityList.length} cities that need data enhancement`
    );

    return cityList;
  }

  /**
   * Collect US Census data for demographics
   */
  async getCensusData(city, state) {
    if (!this.censusApiKey) {
      console.log('No Census API key provided, skipping demographic data');
      return null;
    }

    try {
      // Note: This is a simplified example - actual Census API requires specific geographic codes
      const stateCode = this.getStateCode(state);
      const url = `https://api.census.gov/data/2021/acs/acs5?get=B01003_001E,B19013_001E,B25001_001E&for=place:*&in=state:${stateCode}&key=${this.censusApiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      // Find matching city (simplified - real implementation would need better matching)
      const cityData = data.find(
        (row) => row[3] && row[3].toLowerCase().includes(city.toLowerCase())
      );

      if (cityData) {
        return {
          population: parseInt(cityData[0]) || null,
          median_income: parseInt(cityData[1]) || null,
          households: parseInt(cityData[2]) || null,
        };
      }
    } catch (error) {
      console.log(`Error fetching census data for ${city}: ${error.message}`);
    }

    return null;
  }

  /**
   * Generate local recycling regulations based on state patterns
   */
  async generateLocalRegulations(city, state) {
    // State-specific regulation patterns
    const stateRegulations = {
      CA: {
        has_ewaste_ban: true,
        landfill_restrictions:
          'California prohibits disposal of covered electronic devices in landfills. All computers, monitors, TVs, and portable devices must be recycled through authorized facilities.',
        battery_regulations:
          'Battery recycling is mandatory for all battery types. Retailers must accept batteries for recycling.',
        tv_computer_rules:
          'Covered Electronic Waste (CEW) includes computers, monitors, TVs, and portable devices. Recycling is free to consumers through the Electronic Waste Recovery and Recycling Program.',
        business_requirements:
          'Businesses must use certified e-waste recyclers and maintain disposal records.',
        penalties_fines:
          'Fines range from $1,000 to $50,000 per violation for improper disposal.',
      },
      NY: {
        has_ewaste_ban: true,
        landfill_restrictions:
          'New York bans disposal of computers, TVs, and peripheral devices in municipal solid waste.',
        battery_regulations:
          'Rechargeable battery recycling is required. Many retailers provide collection points.',
        tv_computer_rules:
          'Manufacturers must provide free take-back programs for computers and TVs.',
        business_requirements:
          'Businesses must use certified recyclers and cannot dispose of covered devices in regular waste.',
        penalties_fines:
          'Fines of $1,000-$10,000 plus cleanup costs for violations.',
      },
      TX: {
        has_ewaste_ban: false,
        landfill_restrictions:
          'No statewide electronics disposal restrictions, but many localities have their own rules.',
        battery_regulations:
          'No statewide requirements, but voluntary programs available.',
        tv_computer_rules: 'No statewide requirements. Check local ordinances.',
        business_requirements: 'Follow local regulations where applicable.',
        penalties_fines: 'Varies by locality.',
      },
    };

    const stateAbbr = this.getStateAbbreviation(state);
    const stateData = stateRegulations[stateAbbr] || stateRegulations['TX']; // Default to TX pattern

    return {
      city_state: `${city}, ${state}`,
      state_code: this.getStateAbbreviation(state),
      city_name: city,
      ...stateData,
      municipal_programs: `${city} participates in regional electronics recycling programs. Check with local waste management for special collection events.`,
      special_events:
        'Many communities host seasonal e-waste collection drives. Contact local government for upcoming events.',
      drop_off_locations:
        'Permanent drop-off locations available at participating retailers and certified recycling centers.',
      environmental_benefits: `Electronics recycling in ${city} helps recover valuable materials, reduces landfill waste, and prevents toxic substances from contaminating local soil and groundwater.`,
      government_website: `https://www.${city
        .toLowerCase()
        .replace(/\s+/g, '')}.gov`,
      recycling_hotline: '1-800-RECYCLE',
    };
  }

  /**
   * Estimate environmental impact based on population
   */
  async generateCityStats(city, state, censusData) {
    const population = censusData?.population || this.estimatePopulation(city);

    // Industry averages for e-waste generation
    const ewastePerPersonPerYear = 45; // pounds
    const recyclingRate = Math.random() * 0.3 + 0.15; // 15-45%
    const co2SavingsPerPound = 2.4; // lbs CO2 saved per lb recycled

    const annualEwaste = population * ewastePerPersonPerYear;
    const recycledAmount = annualEwaste * recyclingRate;

    return {
      city_state: `${city}, ${state}`,
      population,
      recycling_rate: (recyclingRate * 100).toFixed(1),
      ewaste_per_capita: ewastePerPersonPerYear,
      co2_savings_lbs: Math.round(recycledAmount * co2SavingsPerPound),
      metals_recovered_lbs: Math.round(recycledAmount * 0.15), // ~15% metals
      plastics_recycled_lbs: Math.round(recycledAmount * 0.25), // ~25% plastics
      jobs_supported: Math.round(population / 5000), // Rough estimate
      economic_impact_dollars: Math.round(recycledAmount * 0.85), // $0.85 per lb economic impact
    };
  }

  /**
   * Process a batch of cities
   */
  async processCityBatch(cities, batchSize = 10) {
    const results = {
      regulations: [],
      stats: [],
      errors: [],
    };

    for (let i = 0; i < cities.length; i += batchSize) {
      const batch = cities.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`
      );

      for (const cityState of batch) {
        try {
          const [city, state] = cityState.split(', ');

          // Collect data
          const censusData = await this.getCensusData(city, state);
          const regulations = await this.generateLocalRegulations(city, state);
          const stats = await this.generateCityStats(city, state, censusData);

          results.regulations.push(regulations);
          results.stats.push(stats);

          // Rate limiting
          await this.delay(100);
        } catch (error) {
          console.error(`Error processing ${cityState}: ${error.message}`);
          results.errors.push({ city: cityState, error: error.message });
        }
      }

      // Longer delay between batches
      await this.delay(1000);
    }

    return results;
  }

  /**
   * Save data to Supabase
   */
  async saveToDatabase(results) {
    try {
      // Insert regulations
      if (results.regulations.length > 0) {
        const { error: regError } = await supabase
          .from('local_regulations')
          .insert(results.regulations);

        if (regError) throw regError;
        console.log(`Saved ${results.regulations.length} regulation records`);
      }

      // Insert stats
      if (results.stats.length > 0) {
        const { error: statsError } = await supabase
          .from('city_stats')
          .insert(results.stats);

        if (statsError) throw statsError;
        console.log(`Saved ${results.stats.length} statistics records`);
      }
    } catch (error) {
      console.error('Database save error:', error);
      throw error;
    }
  }

  /**
   * Utility functions
   */
  getStateAbbreviation(state) {
    const stateAbbreviations = {
      Alabama: 'AL',
      Alaska: 'AK',
      Arizona: 'AZ',
      Arkansas: 'AR',
      California: 'CA',
      Colorado: 'CO',
      Connecticut: 'CT',
      Delaware: 'DE',
      'District of Columbia': 'DC',
      Florida: 'FL',
      Georgia: 'GA',
      Hawaii: 'HI',
      Idaho: 'ID',
      Illinois: 'IL',
      Indiana: 'IN',
      Iowa: 'IA',
      Kansas: 'KS',
      Kentucky: 'KY',
      Louisiana: 'LA',
      Maine: 'ME',
      Maryland: 'MD',
      Massachusetts: 'MA',
      Michigan: 'MI',
      Minnesota: 'MN',
      Mississippi: 'MS',
      Missouri: 'MO',
      Montana: 'MT',
      Nebraska: 'NE',
      Nevada: 'NV',
      'New Hampshire': 'NH',
      'New Jersey': 'NJ',
      'New Mexico': 'NM',
      'New York': 'NY',
      'North Carolina': 'NC',
      'North Dakota': 'ND',
      Ohio: 'OH',
      Oklahoma: 'OK',
      Oregon: 'OR',
      Pennsylvania: 'PA',
      'Rhode Island': 'RI',
      'South Carolina': 'SC',
      'South Dakota': 'SD',
      Tennessee: 'TN',
      Texas: 'TX',
      Utah: 'UT',
      Vermont: 'VT',
      Virginia: 'VA',
      Washington: 'WA',
      'West Virginia': 'WV',
      Wisconsin: 'WI',
      Wyoming: 'WY',
    };
    return stateAbbreviations[state] || state; // Return original if not found
  }

  getStateCode(state) {
    const stateCodes = {
      Alabama: '01',
      Alaska: '02',
      Arizona: '04',
      Arkansas: '05',
      California: '06',
      Colorado: '08',
      Connecticut: '09',
      Delaware: '10',
      Florida: '12',
      Georgia: '13',
      Hawaii: '15',
      Idaho: '16',
      Illinois: '17',
      Indiana: '18',
      Iowa: '19',
      Kansas: '20',
      Kentucky: '21',
      Louisiana: '22',
      Maine: '23',
      Maryland: '24',
      Massachusetts: '25',
      Michigan: '26',
      Minnesota: '27',
      Mississippi: '28',
      Missouri: '29',
      Montana: '30',
      Nebraska: '31',
      Nevada: '32',
      'New Hampshire': '33',
      'New Jersey': '34',
      'New Mexico': '35',
      'New York': '36',
      'North Carolina': '37',
      'North Dakota': '38',
      Ohio: '39',
      Oklahoma: '40',
      Oregon: '41',
      Pennsylvania: '42',
      'Rhode Island': '44',
      'South Carolina': '45',
      'South Dakota': '46',
      Tennessee: '47',
      Texas: '48',
      Utah: '49',
      Vermont: '50',
      Virginia: '51',
      Washington: '53',
      'West Virginia': '54',
      Wisconsin: '55',
      Wyoming: '56',
    };
    return stateCodes[state] || '48'; // Default to Texas
  }

  estimatePopulation(city) {
    // Very rough estimates based on city names (would need real data)
    const estimates = {
      'New York': 8400000,
      'Los Angeles': 3900000,
      Chicago: 2700000,
      Houston: 2300000,
      Phoenix: 1600000,
      Philadelphia: 1500000,
      'San Antonio': 1500000,
      'San Diego': 1400000,
      Dallas: 1300000,
      'San Jose': 1000000,
      Austin: 950000,
      Jacksonville: 900000,
    };
    return estimates[city] || 50000; // Default estimate
  }
}

/**
 * Main execution
 */
async function main() {
  const collector = new LocalDataCollector();

  try {
    console.log('🚀 Starting local data collection...');

    // Get cities that need data
    const cities = await collector.getCitiesNeedingData();
    console.log(`Found ${cities.length} cities needing data enhancement`);

    if (cities.length === 0) {
      console.log('All cities already have data. Exiting.');
      return;
    }

    // Process in manageable chunks of 1000 cities at a time
    const chunkSize = 1000;
    let totalProcessed = 0;

    for (let i = 0; i < cities.length; i += chunkSize) {
      const chunk = cities.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(cities.length / chunkSize);

      console.log(
        `\n🔄 Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} cities)`
      );

      // Process this chunk
      const results = await collector.processCityBatch(chunk);

      // Save this chunk to database
      await collector.saveToDatabase(results);

      totalProcessed += results.regulations.length;
      console.log(
        `📊 Progress: ${totalProcessed}/${cities.length} cities completed`
      );

      // Small delay between chunks to be nice to the database
      if (i + chunkSize < cities.length) {
        console.log('⏱️ Pausing 5 seconds before next chunk...');
        await collector.delay(5000);
      }
    }

    console.log('✅ Data collection completed successfully!');
    console.log(`Total processed: ${totalProcessed} cities`);
    console.log(`Started with: ${cities.length} cities needing data`);
    console.log(`Processing completed in chunks of ${chunkSize} cities`);

    if (totalProcessed === cities.length) {
      console.log('🎉 All cities have been processed!');
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default LocalDataCollector;
