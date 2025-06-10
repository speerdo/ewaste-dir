/*
  # Create complete recycling_centers table with exact production schema
  
  This migration recreates the exact production schema including table structure,
  RLS policies, and adds the new legitimacy tracking columns.
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create recycling_centers table with exact production schema
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

-- Create RLS policies (matching production)
CREATE POLICY IF NOT EXISTS "Allow public read access on recycling_centers" 
    ON recycling_centers FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable read access for all users" 
    ON recycling_centers FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for service role" 
    ON recycling_centers FOR INSERT WITH CHECK (true);

-- Add legitimacy tracking columns
ALTER TABLE recycling_centers 
ADD COLUMN IF NOT EXISTS legitimacy_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS legitimacy_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_legitimate BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ DEFAULT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recycling_centers_state ON recycling_centers(state);
CREATE INDEX IF NOT EXISTS idx_recycling_centers_city ON recycling_centers(city);
CREATE INDEX IF NOT EXISTS idx_recycling_centers_legitimacy ON recycling_centers(is_legitimate);
CREATE INDEX IF NOT EXISTS idx_recycling_centers_location ON recycling_centers USING GIST(location); 
