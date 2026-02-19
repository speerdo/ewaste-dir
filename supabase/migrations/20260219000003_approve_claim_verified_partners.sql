-- ============================================================
-- Update approve_claim to upsert into verified_partners
-- for premium and featured tier claims.
-- Created: 2026-02-19
-- ============================================================

CREATE OR REPLACE FUNCTION approve_claim(p_claim_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_rec business_claims%ROWTYPE;
  existing_id uuid;
  vp_id uuid;
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

  -- --------------------------------------------------------
  -- Upsert into verified_partners for premium / featured tiers
  -- --------------------------------------------------------
  IF claim_rec.tier IN ('premium', 'featured') THEN
    SELECT id INTO vp_id
    FROM verified_partners
    WHERE claim_id = p_claim_id
    LIMIT 1;

    IF vp_id IS NOT NULL THEN
      UPDATE verified_partners SET
        business_name    = claim_rec.business_name,
        city             = claim_rec.city,
        state            = claim_rec.state,
        address          = NULLIF(claim_rec.address, ''),
        phone            = NULLIF(claim_rec.phone, ''),
        website          = NULLIF(claim_rec.website, ''),
        description      = NULLIF(claim_rec.description, ''),
        accepted_devices = claim_rec.accepted_items,
        certifications   = claim_rec.certifications,
        hours            = NULLIF(claim_rec.hours, ''),
        tier             = claim_rec.tier,
        is_featured      = (claim_rec.tier = 'featured'),
        lead_email       = claim_rec.contact_email,
        is_active        = true
      WHERE id = vp_id;
    ELSE
      INSERT INTO verified_partners (
        claim_id,
        business_name, city, state,
        address, phone, website,
        description, accepted_devices, certifications, hours,
        tier, is_featured,
        receives_leads, lead_email,
        is_active
      ) VALUES (
        p_claim_id,
        claim_rec.business_name,
        claim_rec.city,
        claim_rec.state,
        NULLIF(claim_rec.address, ''),
        NULLIF(claim_rec.phone, ''),
        NULLIF(claim_rec.website, ''),
        NULLIF(claim_rec.description, ''),
        claim_rec.accepted_items,
        claim_rec.certifications,
        NULLIF(claim_rec.hours, ''),
        claim_rec.tier,
        (claim_rec.tier = 'featured'),
        true,
        claim_rec.contact_email,
        true
      );
    END IF;
  END IF;

  -- Mark claim active
  UPDATE business_claims
  SET status = 'active', updated_at = now()
  WHERE id = p_claim_id;

  RETURN result_text;
END;
$$;
