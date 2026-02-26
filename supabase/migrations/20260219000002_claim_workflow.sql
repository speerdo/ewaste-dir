-- ============================================================
-- Claim workflow: submission_type + approve_claim function
-- Created: 2026-02-19
-- ============================================================

-- Add submission_type to business_claims
ALTER TABLE business_claims
  ADD COLUMN IF NOT EXISTS submission_type TEXT NOT NULL DEFAULT 'new'
    CHECK (submission_type IN ('new', 'update'));

-- --------------------------------------------------------
-- Update get_all_business_claims to include submission_type
-- --------------------------------------------------------
DROP FUNCTION IF EXISTS get_all_business_claims();
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
  submission_type text,
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
    tier, status, submission_type,
    contact_name, contact_email, contact_phone,
    message, notes,
    description, accepted_items, services_offered, certifications, hours
  FROM business_claims
  ORDER BY created_at DESC;
$$;

-- --------------------------------------------------------
-- approve_claim: publish a claim to recycling_centers
--
-- For submission_type='update': finds existing record by
--   name+city+state (case-insensitive) and updates it.
--   If no match, inserts as new and returns 'no_match_inserted'.
-- For submission_type='new': always inserts a new record.
-- Either way, sets claim status to 'active'.
--
-- Returns: 'inserted' | 'updated' | 'no_match_inserted'
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_claim(p_claim_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_rec business_claims%ROWTYPE;
  existing_id uuid;
  result_text text;
BEGIN
  SELECT * INTO claim_rec FROM business_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim % not found', p_claim_id;
  END IF;

  IF claim_rec.submission_type = 'update' THEN
    -- Try to find an existing recycling_centers record
    SELECT rc.id INTO existing_id
    FROM recycling_centers rc
    WHERE LOWER(TRIM(rc.name))  = LOWER(TRIM(claim_rec.business_name))
      AND LOWER(TRIM(rc.city))  = LOWER(TRIM(claim_rec.city))
      AND LOWER(TRIM(rc.state)) = LOWER(TRIM(claim_rec.state))
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      UPDATE recycling_centers SET
        name          = claim_rec.business_name,
        full_address  = COALESCE(NULLIF(claim_rec.address,  ''), full_address),
        city          = claim_rec.city,
        state         = claim_rec.state,
        postal_code   = CASE
                          WHEN claim_rec.zip ~ '^\d{5}'
                          THEN claim_rec.zip::integer
                          ELSE postal_code
                        END,
        phone         = COALESCE(NULLIF(claim_rec.phone,   ''), phone),
        site          = COALESCE(NULLIF(claim_rec.website, ''), site),
        description   = COALESCE(NULLIF(claim_rec.description, ''), description),
        accepted_items  = CASE
                            WHEN claim_rec.accepted_items IS NOT NULL
                              AND array_length(claim_rec.accepted_items, 1) > 0
                            THEN to_jsonb(claim_rec.accepted_items)
                            ELSE accepted_items
                          END,
        services_offered = CASE
                            WHEN claim_rec.services_offered IS NOT NULL
                              AND array_length(claim_rec.services_offered, 1) > 0
                            THEN to_jsonb(claim_rec.services_offered)
                            ELSE services_offered
                          END,
        certifications  = CASE
                            WHEN claim_rec.certifications IS NOT NULL
                              AND array_length(claim_rec.certifications, 1) > 0
                            THEN to_jsonb(claim_rec.certifications)
                            ELSE certifications
                          END,
        working_hours   = CASE
                            WHEN claim_rec.hours IS NOT NULL AND claim_rec.hours != ''
                            THEN jsonb_build_object('text', claim_rec.hours)
                            ELSE working_hours
                          END,
        content_enhanced    = true,
        content_enhanced_at = now(),
        updated_at          = now()
      WHERE id = existing_id;

      result_text := 'updated';
    ELSE
      -- No match found: insert as new
      INSERT INTO recycling_centers (
        name, full_address, city, state, postal_code, phone, site,
        description, accepted_items, services_offered, certifications,
        working_hours, content_enhanced, content_enhanced_at
      ) VALUES (
        claim_rec.business_name,
        NULLIF(claim_rec.address, ''),
        claim_rec.city,
        claim_rec.state,
        CASE WHEN claim_rec.zip ~ '^\d{5}' THEN claim_rec.zip::integer ELSE NULL END,
        NULLIF(claim_rec.phone, ''),
        NULLIF(claim_rec.website, ''),
        NULLIF(claim_rec.description, ''),
        COALESCE(to_jsonb(claim_rec.accepted_items), '[]'::jsonb),
        COALESCE(to_jsonb(claim_rec.services_offered), '[]'::jsonb),
        COALESCE(to_jsonb(claim_rec.certifications), '[]'::jsonb),
        CASE WHEN claim_rec.hours IS NOT NULL AND claim_rec.hours != ''
             THEN jsonb_build_object('text', claim_rec.hours) ELSE NULL END,
        true,
        now()
      );

      result_text := 'no_match_inserted';
    END IF;

  ELSE
    -- New listing
    INSERT INTO recycling_centers (
      name, full_address, city, state, postal_code, phone, site,
      description, accepted_items, services_offered, certifications,
      working_hours, content_enhanced, content_enhanced_at
    ) VALUES (
      claim_rec.business_name,
      NULLIF(claim_rec.address, ''),
      claim_rec.city,
      claim_rec.state,
      CASE WHEN claim_rec.zip ~ '^\d{5}' THEN claim_rec.zip::integer ELSE NULL END,
      NULLIF(claim_rec.phone, ''),
      NULLIF(claim_rec.website, ''),
      NULLIF(claim_rec.description, ''),
      COALESCE(to_jsonb(claim_rec.accepted_items), '[]'::jsonb),
      COALESCE(to_jsonb(claim_rec.services_offered), '[]'::jsonb),
      COALESCE(to_jsonb(claim_rec.certifications), '[]'::jsonb),
      CASE WHEN claim_rec.hours IS NOT NULL AND claim_rec.hours != ''
           THEN jsonb_build_object('text', claim_rec.hours) ELSE NULL END,
      true,
      now()
    );

    result_text := 'inserted';
  END IF;

  -- Mark claim active
  UPDATE business_claims
  SET status = 'active', updated_at = now()
  WHERE id = p_claim_id;

  RETURN result_text;
END;
$$;
