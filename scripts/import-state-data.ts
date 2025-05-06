import { createClient } from '@supabase/supabase-js';
import { parseStateData } from '../src/utils/stateDataImport';
import path from 'path';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

async function importStateData() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const stateDataPath = path.join(
    __dirname,
    '..',
    'data',
    'state-descriptions.txt'
  );

  try {
    const stateData = parseStateData(stateDataPath);

    for (const state of stateData) {
      const { error } = await supabase.from('state_info').upsert(
        {
          state_code: state.stateCode,
          state_name: state.stateName,
          description: state.description,
          image_alt: state.imageAlt,
        },
        {
          onConflict: 'state_code',
        }
      );

      if (error) {
        console.error(`Error importing ${state.stateName}:`, error);
      } else {
        console.log(`Imported ${state.stateName}`);
      }
    }

    console.log('Import completed');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importStateData();
