/*
  # Create recycling_centers table
  
  This migration creates the base recycling_centers table structure
  to ensure it exists before other migrations try to modify it.
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create recycling_centers table with base schema
CREATE TABLE IF NOT EXISTS recycling_centers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    site TEXT,
    phone TEXT,
    full_address TEXT,
    city TEXT,
    postal_code INTEGER,
    state TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    rating NUMERIC,
    reviews NUMERIC,
    photo TEXT,
    logo TEXT,
    description TEXT,
    working_hours JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    location GEOGRAPHY(POINT, 4326)
);

-- Enable RLS
ALTER TABLE recycling_centers ENABLE ROW LEVEL SECURITY;

-- Create a simple read policy
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'recycling_centers' 
        AND policyname = 'Allow public read access on recycling_centers'
    ) THEN
        CREATE POLICY "Allow public read access on recycling_centers" 
            ON recycling_centers FOR SELECT USING (true);
    END IF;
END $$;

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_recycling_centers_state ON recycling_centers(state);
CREATE INDEX IF NOT EXISTS idx_recycling_centers_city ON recycling_centers(city);
CREATE INDEX IF NOT EXISTS idx_recycling_centers_location ON recycling_centers USING GIST(location); 
