-- ============================================================
-- Add content_enhanced column + protect manual/partner records
-- Created: 2026-03-06
-- ============================================================
--
-- content_enhanced is used by 4-reconcile.js to skip deletion
-- of records that have been manually curated or claimed by a
-- partner. Without this column the reconcile script crashes on
-- its first DB fetch (fetchAllRecyclingCenters selects it).
--
-- content_enhanced_at is set automatically by the existing
-- trigger (trigger_update_content_enhanced_timestamp) defined
-- in migration 20250124000003. If that trigger doesn't exist
-- yet in this environment, the column still works fine without
-- the trigger — the timestamp just won't auto-populate.
-- ============================================================

-- ─── Add columns ─────────────────────────────────────────────────────────────

ALTER TABLE recycling_centers
  ADD COLUMN IF NOT EXISTS content_enhanced     BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS content_enhanced_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recycling_centers_content_enhanced
  ON recycling_centers (content_enhanced);

-- ─── Protect known partner / manually-added records ──────────────────────────
--
-- These records are not in the 2026 Google Places discovery results and
-- would be deleted by 4-reconcile.js without this flag set.
--
-- Flathead E-Waste Recycling (Kalispell, MT)
--   • Active local partner, manually added to the DB
--   • Not returned by Google Places discovery (weak Maps presence)
--   • ID: 2b3d6b79-54bc-49c6-9ccc-2c412ee67193
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE recycling_centers
SET
  content_enhanced    = TRUE,
  content_enhanced_at = NOW()
WHERE id = '2b3d6b79-54bc-49c6-9ccc-2c412ee67193';
