/*
  # Electronics Recycling Database Schema

  1. New Tables
    - `states`
      - `id` (text, primary key)
      - `name` (text, not null)
      - `description` (text)
      - `image_url` (text)
      - `featured` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `cities`
      - `id` (text, primary key)
      - `state_id` (text, references states)
      - `name` (text, not null)
      - `description` (text)
      - `address` (text)
      - `lat` (numeric)
      - `lng` (numeric)
      - `image_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access
*/

-- Create states table
CREATE TABLE IF NOT EXISTS states (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text,
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cities table with foreign key to states
CREATE TABLE IF NOT EXISTS cities (
  id text PRIMARY KEY,
  state_id text REFERENCES states(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  address text,
  lat numeric,
  lng numeric,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE states ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on states"
  ON states FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access on cities"
  ON cities FOR SELECT
  TO public
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_states_featured ON states(featured);
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON cities(state_id);