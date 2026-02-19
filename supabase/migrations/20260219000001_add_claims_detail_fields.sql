-- ============================================================
-- Add detail fields to business_claims
-- Created: 2026-02-19
-- ============================================================

ALTER TABLE business_claims
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS accepted_items TEXT[],
  ADD COLUMN IF NOT EXISTS services_offered TEXT[],
  ADD COLUMN IF NOT EXISTS certifications TEXT[],
  ADD COLUMN IF NOT EXISTS hours TEXT;

-- --------------------------------------------------------
-- Update get_all_business_claims to return new columns
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION get_all_business_claims()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  business_name text,
  city text,
  state text,
  zip text,
  address text,
  phone text,
  website text,
  tier text,
  status text,
  contact_name text,
  contact_email text,
  contact_phone text,
  message text,
  notes text,
  description text,
  accepted_items text[],
  services_offered text[],
  certifications text[],
  hours text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, created_at, updated_at,
    business_name, city, state, zip, address, phone, website,
    tier, status,
    contact_name, contact_email, contact_phone,
    message, notes,
    description, accepted_items, services_offered, certifications, hours
  FROM business_claims
  ORDER BY created_at DESC;
$$;
