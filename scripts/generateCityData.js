// scripts/generateCityData.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl =
  process.env.PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY || 'dummy-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to fetch all city data with pagination
async function fetchAllCityStatePairs() {
  const cityStatePairs = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error, count } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude', { count: 'exact' })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching data:', error);
      break;
    }

    if (data && data.length > 0) {
      // Process data and add to cityStatePairs
      data.forEach((item) => {
        if (item.city && item.state) {
          const cityName = item.city.trim();
          const stateName = item.state.trim();

          // Create url-friendly slugs
          const citySlug = cityName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          const stateSlug = stateName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

          // Build URL
          const url = `/states/${stateSlug}/${citySlug}`;

          // Add coordinates if available
          const coordinates =
            item.latitude && item.longitude
              ? {
                  lat:
                    typeof item.latitude === 'string'
                      ? parseFloat(item.latitude)
                      : item.latitude,
                  lng:
                    typeof item.longitude === 'string'
                      ? parseFloat(item.longitude)
                      : item.longitude,
                }
              : undefined;

          // Special logging for Joplin
          if (cityName === 'Joplin' && stateName === 'Missouri') {
            console.error(
              `Found Joplin, Missouri - Coordinates: ${JSON.stringify(
                coordinates
              )}`
            );
          }

          // Add city data to array
          cityStatePairs.push({
            city: cityName,
            state: stateName,
            url,
            coordinates,
          });
        }
      });

      // Move to next page if we got a full page of results
      if (data.length === pageSize) {
        page++;
        console.error(`Fetched page ${page}, got ${data.length} results`);
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  // Remove duplicates (by city+state combination)
  const uniqueCities = [];
  const seen = new Set();

  for (const pair of cityStatePairs) {
    const key = `${pair.city.toLowerCase()},${pair.state.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCities.push(pair);
    }
  }

  console.error(`Total unique city/state pairs: ${uniqueCities.length}`);
  return uniqueCities;
}

// Main function
async function generateCityData() {
  try {
    const cityData = await fetchAllCityStatePairs();

    // Output the data as JSON to stdout
    console.log(JSON.stringify(cityData, null, 2));
  } catch (error) {
    console.error('Error generating city data:', error);
    process.exit(1);
  }
}

// Run the main function
generateCityData();
