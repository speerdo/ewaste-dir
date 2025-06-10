/*
  # Add legitimacy tracking columns to recycling_centers

  1. New Columns
    - `legitimacy_score` (integer) - Numeric score indicating legitimacy (higher = more legitimate)
    - `legitimacy_reason` (text) - Explanation of the legitimacy assessment
    - `is_legitimate` (boolean) - Quick flag for legitimate recycling businesses
    - `is_suspicious` (boolean) - Quick flag for businesses that may not be recycling centers
    - `scraped_at` (timestamptz) - When the website was last scraped

  2. Notes
    - These columns support the web scraping legitimacy verification process
    - Allows filtering out non-recycling businesses from the directory
    - Helps prioritize legitimate centers in search results
*/

-- Add legitimacy tracking columns
ALTER TABLE recycling_centers 
ADD COLUMN IF NOT EXISTS legitimacy_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS legitimacy_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_legitimate BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ DEFAULT NULL;

-- Create indexes for filtering by legitimacy
CREATE INDEX IF NOT EXISTS idx_recycling_centers_legitimate 
  ON recycling_centers(is_legitimate) WHERE is_legitimate = true;

CREATE INDEX IF NOT EXISTS idx_recycling_centers_suspicious 
  ON recycling_centers(is_suspicious) WHERE is_suspicious = true;

CREATE INDEX IF NOT EXISTS idx_recycling_centers_legitimacy_score 
  ON recycling_centers(legitimacy_score) WHERE legitimacy_score IS NOT NULL; 
