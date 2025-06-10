/*
  # Create recycling centers table

  1. New Tables
    - `recycling_centers`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `site` (text)
      - `phone` (text)
      - `full_address` (text)
      - `city` (text)
      - `postal_code` (integer)
      - `state` (text)
      - `latitude` (numeric)
      - `longitude` (numeric)
      - `rating` (numeric)
      - `reviews` (numeric)
      - `photo` (text)
      - `logo` (text)
      - `description` (text)
      - `working_hours` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `recycling_centers` table
    - Add policy for public read access
    - Add indexes for common search patterns

  3. Notes
    - `working_hours` is stored as JSONB to maintain the flexible structure
    - Indexes added for location-based queries
*/

CREATE TABLE IF NOT EXISTS recycling_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  site text,
  phone text,
  full_address text,
  city text,
  postal_code integer,
  state text,
  latitude numeric,
  longitude numeric,
  rating numeric,
  reviews numeric,
  photo text,
  logo text,
  description text,
  working_hours jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE recycling_centers ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (skip if exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'recycling_centers' 
        AND policyname = 'Allow public read access on recycling_centers'
    ) THEN
        CREATE POLICY "Allow public read access on recycling_centers"
          ON recycling_centers FOR SELECT
          TO public
          USING (true);
    END IF;
END $$;

-- Create indexes for common search patterns
CREATE INDEX IF NOT EXISTS idx_recycling_centers_location 
  ON recycling_centers(state, city);

CREATE INDEX IF NOT EXISTS idx_recycling_centers_coordinates 
  ON recycling_centers(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_recycling_centers_postal 
  ON recycling_centers(postal_code);
