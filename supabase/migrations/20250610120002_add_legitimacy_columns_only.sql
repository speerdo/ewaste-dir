/*
  # Add legitimacy tracking columns to existing recycling_centers table
  
  This migration adds only the legitimacy tracking columns needed for 
  website scraping verification without attempting table creation.
*/

-- Add legitimacy tracking columns
DO $$ 
BEGIN
    -- Only add columns if the table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recycling_centers') THEN
        -- Add legitimacy tracking columns
        ALTER TABLE recycling_centers 
        ADD COLUMN IF NOT EXISTS legitimacy_score INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS legitimacy_reason TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS is_legitimate BOOLEAN DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ DEFAULT NULL;
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_recycling_centers_legitimacy ON recycling_centers(is_legitimate);
        
        RAISE NOTICE 'Legitimacy columns added successfully';
    ELSE
        RAISE NOTICE 'recycling_centers table does not exist, skipping column addition';
    END IF;
END $$; 
