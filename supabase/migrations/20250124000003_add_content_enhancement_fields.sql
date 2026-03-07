/*
  # Add Content Enhancement Fields
  
  This migration adds fields to support enhanced content generation
  for AdSense approval requirements.
  
  New Fields:
    - accepted_items: JSONB array of accepted electronics types
    - rejected_items: JSONB array of rejected items
    - services_offered: JSONB array of services (data destruction, ITAD, etc.)
    - certifications: JSONB array of certifications (R2, e-Stewards, etc.)
    - preparation_instructions: Text field with preparation requirements
    - accessibility_info: Text field with accessibility information
    - content_enhanced: Boolean flag to track enhancement status
    - content_enhanced_at: Timestamp of last content enhancement
*/

-- Add new fields to recycling_centers table
ALTER TABLE recycling_centers 
ADD COLUMN IF NOT EXISTS accepted_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS rejected_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS services_offered JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS preparation_instructions TEXT,
ADD COLUMN IF NOT EXISTS accessibility_info TEXT,
ADD COLUMN IF NOT EXISTS content_enhanced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS content_enhanced_at TIMESTAMPTZ;

-- Add indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_recycling_centers_content_enhanced 
  ON recycling_centers(content_enhanced);

CREATE INDEX IF NOT EXISTS idx_recycling_centers_services_offered 
  ON recycling_centers USING GIN(services_offered);

CREATE INDEX IF NOT EXISTS idx_recycling_centers_certifications 
  ON recycling_centers USING GIN(certifications);

-- Add comments for documentation
COMMENT ON COLUMN recycling_centers.accepted_items IS 'JSONB array of accepted electronics types (e.g., ["computers", "phones", "TVs"])';
COMMENT ON COLUMN recycling_centers.rejected_items IS 'JSONB array of rejected items (e.g., ["large appliances", "hazardous materials"])';
COMMENT ON COLUMN recycling_centers.services_offered IS 'JSONB array of services offered (e.g., ["data destruction", "ITAD", "pickup"])';
COMMENT ON COLUMN recycling_centers.certifications IS 'JSONB array of certifications (e.g., ["R2", "e-Stewards", "NAID"])';
COMMENT ON COLUMN recycling_centers.preparation_instructions IS 'Text instructions for preparing items for recycling';
COMMENT ON COLUMN recycling_centers.accessibility_info IS 'Information about accessibility features and accommodations';
COMMENT ON COLUMN recycling_centers.content_enhanced IS 'Flag indicating if content has been enhanced for AdSense requirements';
COMMENT ON COLUMN recycling_centers.content_enhanced_at IS 'Timestamp of last content enhancement';

-- Create a function to update content_enhanced_at when content_enhanced changes
CREATE OR REPLACE FUNCTION update_content_enhanced_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content_enhanced = TRUE AND OLD.content_enhanced = FALSE THEN
    NEW.content_enhanced_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update timestamp
DROP TRIGGER IF EXISTS trigger_update_content_enhanced_timestamp ON recycling_centers;
CREATE TRIGGER trigger_update_content_enhanced_timestamp
  BEFORE UPDATE ON recycling_centers
  FOR EACH ROW
  EXECUTE FUNCTION update_content_enhanced_timestamp();

-- Add some sample data for testing
UPDATE recycling_centers 
SET 
  accepted_items = '["computers", "laptops", "phones", "tablets", "TVs", "monitors"]'::jsonb,
  rejected_items = '["large appliances", "hazardous materials", "medical devices"]'::jsonb,
  services_offered = '["data destruction", "certificate of destruction", "pickup service"]'::jsonb,
  preparation_instructions = 'Remove all personal data, remove batteries when possible, call ahead to confirm hours and accepted items.',
  content_enhanced = TRUE,
  content_enhanced_at = NOW()
WHERE id IN (
  SELECT id FROM recycling_centers
  WHERE legitimacy_score >= 50
    AND content_enhanced = FALSE
  LIMIT 100
);

-- Create a view for enhanced content reporting
CREATE OR REPLACE VIEW enhanced_content_report AS
SELECT 
  state,
  city,
  COUNT(*) as total_centers,
  COUNT(*) FILTER (WHERE content_enhanced = TRUE) as enhanced_centers,
  COUNT(*) FILTER (WHERE content_enhanced = FALSE) as pending_enhancement,
  ROUND(
    CASE WHEN COUNT(*) = 0 THEN 0
    ELSE (COUNT(*) FILTER (WHERE content_enhanced = TRUE)::DECIMAL / COUNT(*)) * 100
    END,
    2
  ) as enhancement_percentage
FROM recycling_centers
WHERE city IS NOT NULL AND state IS NOT NULL
GROUP BY state, city
ORDER BY enhancement_percentage DESC, total_centers DESC;

-- Add comment for the view
COMMENT ON VIEW enhanced_content_report IS 'Report showing content enhancement status by city for AdSense compliance tracking';
