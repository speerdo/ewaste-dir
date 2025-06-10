/*
  # Ensure recycling_centers table exists and add legitimacy tracking columns
  
  This migration ensures the recycling_centers table exists with all necessary columns
  before adding the legitimacy tracking columns. This allows the branch to work
  independently of dashboard-created tables.
*/

-- Enable PostGIS extension (required for GEOGRAPHY data type)
CREATE EXTENSION IF NOT EXISTS postgis;

-- First, create the recycling_centers table if it doesn't exist
CREATE TABLE IF NOT EXISTS recycling_centers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Create RLS policy for public read access
CREATE POLICY IF NOT EXISTS "Allow public read access" ON recycling_centers
    FOR SELECT USING (true);

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
