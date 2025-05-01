import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase credentials. Please connect to Supabase first.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findJsonFile() {
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'data', 'electronics_recycling.json'),
    path.join(process.cwd(), 'data', 'electronics_recycling.json'),
    path.join(process.cwd(), 'data', 'recycling-centers.json'),
  ];

  for (const filePath of possiblePaths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      continue;
    }
  }

  throw new Error('Could not find recycling centers data file');
}

async function validateData(centers) {
  const requiredFields = ['name'];
  const errors = [];

  centers.forEach((center, index) => {
    requiredFields.forEach((field) => {
      if (!center[field]) {
        errors.push(`Record ${index + 1}: Missing required field '${field}'`);
      }
    });

    // Validate coordinates if present
    if (center.latitude && (center.latitude < -90 || center.latitude > 90)) {
      errors.push(`Record ${index + 1}: Invalid latitude value`);
    }
    if (
      center.longitude &&
      (center.longitude < -180 || center.longitude > 180)
    ) {
      errors.push(`Record ${index + 1}: Invalid longitude value`);
    }
  });

  if (errors.length > 0) {
    console.error('Data validation errors:');
    errors.forEach((error) => console.error(`- ${error}`));
    throw new Error('Data validation failed');
  }
}

function cleanData(center) {
  const cleaned = { ...center };

  // Convert "None" and empty strings to null for all fields
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === 'None' || cleaned[key] === '') {
      cleaned[key] = null;
    }
  });

  // Ensure numeric fields are properly formatted
  if (cleaned.latitude) cleaned.latitude = parseFloat(cleaned.latitude);
  if (cleaned.longitude) cleaned.longitude = parseFloat(cleaned.longitude);

  // Ensure name is not null (use a placeholder if needed)
  if (!cleaned.name) {
    cleaned.name = `Recycling Center (${cleaned.city || ''}, ${
      cleaned.state || ''
    })`.trim();
    if (cleaned.name === 'Recycling Center ()') {
      cleaned.name = 'Unnamed Recycling Center';
    }
  }

  return cleaned;
}

async function importData() {
  try {
    // Find and read the JSON file
    const jsonPath = await findJsonFile();
    console.log('Reading data from:', jsonPath);

    const data = await fs.readFile(jsonPath, 'utf-8');
    const allCenters = JSON.parse(data);

    // Filter out entries without city or state
    const centers = allCenters.filter((center) => center.city && center.state);
    console.log(`Found ${allCenters.length} total recycling centers`);
    console.log(
      `Filtered to ${centers.length} centers with complete city/state data`
    );

    // Validate the remaining data
    await validateData(centers);

    // Process in batches of 100
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < centers.length; i += batchSize) {
      const batch = centers.slice(i, i + batchSize).map(cleanData);
      const currentBatch = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(centers.length / batchSize);

      console.log(`Processing batch ${currentBatch}/${totalBatches}...`);

      try {
        // Insert data
        const { data, error } = await supabase
          .from('recycling_centers')
          .upsert(batch, {
            onConflict: 'name,full_address',
            ignoreDuplicates: true,
          })
          .select();

        if (error) {
          console.error(`Error inserting batch ${currentBatch}:`, error);
          errorCount += batch.length;
          continue;
        }

        successCount += data.length;
        console.log(
          `Successfully imported ${data.length} records in batch ${currentBatch}`
        );
      } catch (error) {
        console.error(`Error processing batch ${currentBatch}:`, error);
        errorCount += batch.length;
      }
    }

    console.log('\nImport Summary:');
    console.log('---------------');
    console.log(`Total records processed: ${centers.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed to import: ${errorCount}`);
    console.log('---------------');

    if (errorCount > 0) {
      console.log(
        '\nSome records failed to import. Please check the error messages above.'
      );
      process.exit(1);
    } else {
      console.log('\nData import completed successfully!');
    }
  } catch (error) {
    console.error('Error importing data:', error);
    process.exit(1);
  }
}

importData();
