-- Migration: Enhance cities table for AI-generated descriptions
-- Created: November 2, 2025
-- Purpose: Add columns to store AI-generated city descriptions and verification status

-- Add new columns to cities table
ALTER TABLE cities 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS description_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS description_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description_source TEXT, -- 'openai', 'anthropic', 'gemini'
  ADD COLUMN IF NOT EXISTS recycling_center_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS population INTEGER;

-- Add index for querying cities needing descriptions
CREATE INDEX IF NOT EXISTS idx_cities_description_null 
  ON cities(state_id) 
  WHERE description IS NULL;

-- Add index for verified descriptions
CREATE INDEX IF NOT EXISTS idx_cities_description_verified 
  ON cities(id, description_verified) 
  WHERE description_verified = true;

-- Add comment explaining the description_source field
COMMENT ON COLUMN cities.description_source IS 'AI provider used to generate description: openai, anthropic, or gemini';

-- Update function to get cities with description status
CREATE OR REPLACE FUNCTION get_cities_description_stats()
RETURNS TABLE (
  total_cities BIGINT,
  cities_with_descriptions BIGINT,
  verified_descriptions BIGINT,
  pending_verification BIGINT,
  avg_description_length NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_cities,
    COUNT(description)::BIGINT as cities_with_descriptions,
    COUNT(CASE WHEN description_verified = true THEN 1 END)::BIGINT as verified_descriptions,
    COUNT(CASE WHEN description IS NOT NULL AND description_verified = false THEN 1 END)::BIGINT as pending_verification,
    AVG(LENGTH(description))::NUMERIC as avg_description_length
  FROM cities;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_cities_description_stats() IS 'Returns statistics about city description generation and verification status';

