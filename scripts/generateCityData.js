import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Ensure environment variables are set
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key environment variables must be set.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function extractCityData() {
  console.log('Connecting to Supabase and extracting city data...');

  // Collect all data with pagination
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching page ${page + 1}...`);

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(
        `Error fetching data from Supabase on page ${page + 1}:`,
        error
      );
      break;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      console.log(`Fetched ${data.length} rows on page ${page + 1}`);

      // Check if we got fewer results than the page size, which means we're done
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }

    page++;
  }

  console.log(
    `Fetched a total of ${allData.length} rows with coordinate data.`
  );

  // Special check for Joplin, Missouri
  let hasJoplin = false;
  for (const row of allData) {
    if (row.city === 'Joplin' && row.state === 'Missouri') {
      hasJoplin = true;
      console.log('Found Joplin, Missouri in the data:', row);
      break;
    }
  }

  if (!hasJoplin) {
    console.log(
      'Joplin, Missouri was not found in the initial data. Fetching specifically...'
    );
    const { data: joplinData, error: joplinError } = await supabase
      .from('recycling_centers')
      .select('city, state, latitude, longitude')
      .eq('city', 'Joplin')
      .eq('state', 'Missouri')
      .limit(1);

    if (joplinError) {
      console.error('Error fetching Joplin, Missouri data:', joplinError);
    } else if (joplinData && joplinData.length > 0) {
      console.log('Found Joplin, Missouri from specific query:', joplinData[0]);
      allData.push(joplinData[0]); // Add to our data array
    } else {
      console.log('Joplin, Missouri not found in the database.');
    }
  }

  // Process data to get distinct city/state pairs and format for cityStatePairs
  const cityDataMap = new Map();

  for (const row of allData) {
    const { city, state, latitude, longitude } = row;

    // Ensure city and state are valid strings and coordinates are numbers
    if (
      typeof city === 'string' &&
      city.trim() !== '' &&
      typeof state === 'string' &&
      state.trim() !== '' &&
      (typeof latitude === 'number' ||
        (typeof latitude === 'string' && !isNaN(parseFloat(latitude)))) &&
      (typeof longitude === 'number' ||
        (typeof longitude === 'string' && !isNaN(parseFloat(longitude))))
    ) {
      const key = `${city.trim().toLowerCase()},${state.trim().toLowerCase()}`;

      // If we haven't added this city/state yet, add it
      if (!cityDataMap.has(key)) {
        // Generate a simple slug for the URL
        const citySlug = city
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-*|-*$/g, '');
        const stateSlug = state
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-*|-*$/g, '');
        const url = `/locations/${stateSlug}/${citySlug}`;

        cityDataMap.set(key, {
          city: city.trim(),
          state: state.trim(),
          coordinates: {
            lat: typeof latitude === 'string' ? parseFloat(latitude) : latitude,
            lng:
              typeof longitude === 'string' ? parseFloat(longitude) : longitude,
          },
          url: url,
        });
      }
    }
  }

  const cityStatePairs = Array.from(cityDataMap.values());

  console.log(`Extracted ${cityStatePairs.length} distinct city/state pairs.`);

  // Check if Joplin is in the final result
  const joplinEntry = cityStatePairs.find(
    (entry) => entry.city === 'Joplin' && entry.state === 'Missouri'
  );
  if (joplinEntry) {
    console.log(
      'Joplin, Missouri is included in the final output:',
      joplinEntry
    );
  } else {
    console.log(
      'Joplin, Missouri is still not in the final output. This might be due to data format issues.'
    );
  }

  // Write the JSON data to a file
  const filePath = join(process.cwd(), 'src', 'data', 'generatedCityData.json');
  const jsonData = JSON.stringify(cityStatePairs, null, 2);

  try {
    await writeFile(filePath, jsonData);
    console.log(`Successfully wrote city data to ${filePath}`);
  } catch (error) {
    console.error('Error writing city data to file:', error);
  }
}

extractCityData().catch(console.error);
