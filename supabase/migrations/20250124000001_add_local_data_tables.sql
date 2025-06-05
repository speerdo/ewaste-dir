/*
  # Add local data enhancement tables

  1. New Tables
    - `local_regulations` - Store local recycling regulations by city/state
    - `city_stats` - Store environmental impact statistics by city/state

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access
*/

-- Create local_regulations table
CREATE TABLE IF NOT EXISTS local_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_state text NOT NULL UNIQUE,
  state_code text NOT NULL,
  city_name text NOT NULL,
  has_ewaste_ban boolean DEFAULT false,
  landfill_restrictions text,
  battery_regulations text,
  tv_computer_rules text,
  business_requirements text,
  penalties_fines text,
  municipal_programs text,
  special_events text,
  drop_off_locations text,
  environmental_benefits text,
  government_website text,
  recycling_hotline text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create city_stats table
CREATE TABLE IF NOT EXISTS city_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_state text NOT NULL UNIQUE,
  population integer,
  recycling_rate text,
  ewaste_per_capita integer,
  co2_savings_lbs integer,
  metals_recovered_lbs integer,
  plastics_recycled_lbs integer,
  jobs_supported integer,
  economic_impact_dollars integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE local_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on local_regulations"
  ON local_regulations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access on city_stats"
  ON city_stats FOR SELECT
  TO public
  USING (true);

-- Create indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_local_regulations_city_state 
  ON local_regulations(city_state);

CREATE INDEX IF NOT EXISTS idx_local_regulations_state_code 
  ON local_regulations(state_code);

CREATE INDEX IF NOT EXISTS idx_city_stats_city_state 
  ON city_stats(city_state); 
