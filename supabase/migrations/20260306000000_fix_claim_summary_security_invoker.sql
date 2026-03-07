-- ============================================================
-- Fix claim_summary view: switch to SECURITY INVOKER
-- Created: 2026-03-06
-- ============================================================
--
-- Problem: PostgreSQL views run as the view owner (implicit
-- SECURITY DEFINER) unless explicitly set to SECURITY INVOKER.
-- claim_summary queried business_claims, which has RLS
-- restricting SELECT to service_role only. With the old view,
-- any caller who could SELECT the view bypassed that RLS and
-- saw aggregate counts as the owner.
--
-- Fix: Recreate the view with security_invoker = true so
-- queries run under the CALLER's privileges and RLS context.
-- The anon/authenticated roles cannot SELECT business_claims
-- directly (blocked by RLS), so they will correctly get no
-- rows from the view.
--
-- Admin access: use get_claim_summary() below instead of
-- querying the view directly. It is SECURITY DEFINER with a
-- narrow, audited scope (aggregate counts only — no PII).
-- ============================================================

-- ─── Recreate view as SECURITY INVOKER ────────────────────────────────────────

DROP VIEW IF EXISTS claim_summary;

CREATE OR REPLACE VIEW claim_summary
  WITH (security_invoker = true)
AS
SELECT
  tier,
  status,
  count(*)         AS count,
  min(created_at)  AS oldest,
  max(created_at)  AS newest
FROM business_claims
GROUP BY tier, status
ORDER BY tier, status;

-- ─── Admin helper: get_claim_summary() ────────────────────────────────────────
--
-- Intentionally SECURITY DEFINER. Justified because:
--   1. Exposes only non-sensitive aggregate data (counts + date
--      range per tier/status). No PII, no claim contents.
--   2. The underlying table (business_claims) is not directly
--      accessible to the anon/authenticated roles.
--   3. Mirrors the existing pattern used by get_all_business_claims()
--      and other admin helpers in this migration set.
--
-- If the admin page is ever migrated to use the service_role key,
-- add: REVOKE ALL ON FUNCTION get_claim_summary() FROM PUBLIC;
--      GRANT EXECUTE ON FUNCTION get_claim_summary() TO service_role;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_claim_summary()
RETURNS TABLE (
  tier   text,
  status text,
  count  bigint,
  oldest timestamptz,
  newest timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tier,
    status,
    count(*)         AS count,
    min(created_at)  AS oldest,
    max(created_at)  AS newest
  FROM business_claims
  GROUP BY tier, status
  ORDER BY tier, status;
$$;
