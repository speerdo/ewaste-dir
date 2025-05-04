/*
  # Create stored procedure to retrieve all unique city-state combinations

  This procedure efficiently retrieves all unique city-state combinations
  from the recycling_centers table. This is used by the getStaticPaths
  function to generate static pages for all cities.
*/

-- Create the function to get all unique city-state combinations
CREATE OR REPLACE FUNCTION get_all_city_states()
RETURNS TABLE (state text, city text, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.state, 
    rc.city, 
    COUNT(*) as count
  FROM 
    recycling_centers rc
  WHERE 
    rc.state IS NOT NULL AND
    rc.city IS NOT NULL AND
    TRIM(rc.state) <> '' AND
    TRIM(rc.city) <> ''
  GROUP BY 
    rc.state, rc.city
  ORDER BY 
    rc.state, rc.city;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
