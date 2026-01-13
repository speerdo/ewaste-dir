/*
  # Add excluded_specialties field to recycling_centers table
  
  This migration adds a field to allow manual exclusion of specific
  business specialties that are incorrectly auto-detected.
*/

-- Add excluded_specialties column as JSONB array
ALTER TABLE recycling_centers 
ADD COLUMN IF NOT EXISTS excluded_specialties JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN recycling_centers.excluded_specialties IS 'JSONB array of specialty tags to exclude from display (e.g., ["Metal Recycling", "Computer Repair"])';

-- Create index for queries filtering by excluded specialties
CREATE INDEX IF NOT EXISTS idx_recycling_centers_excluded_specialties 
ON recycling_centers USING GIN(excluded_specialties);
