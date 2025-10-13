-- Migration: Add RPC function to get distinct cities by state
-- This dramatically speeds up build performance by avoiding multiple pagination queries

CREATE OR REPLACE FUNCTION get_distinct_cities_by_state(state_name TEXT)
RETURNS TABLE (city TEXT) 
LANGUAGE SQL
STABLE
AS $$
  SELECT DISTINCT recycling_centers.city
  FROM recycling_centers
  WHERE recycling_centers.state ILIKE state_name
    AND recycling_centers.city IS NOT NULL
  ORDER BY recycling_centers.city;
$$;

-- Add comment
COMMENT ON FUNCTION get_distinct_cities_by_state(TEXT) IS 'Returns distinct cities for a given state - optimized for build performance';

