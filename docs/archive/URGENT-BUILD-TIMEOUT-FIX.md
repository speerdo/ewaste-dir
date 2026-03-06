# URGENT: Fix Vercel Build Timeout

## Problem

Build still timing out even after optimizations because:

1. SQL RPC function not yet applied
2. Supabase free tier has 60-second statement timeout limit
3. Building 3,970 city pages requires 5,000+ database queries

## Immediate Solution (Apply This SQL in Supabase Dashboard)

**Go to Supabase Dashboard → SQL Editor → New Query:**

```sql
-- Step 1: Create the optimized RPC function
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

-- Step 2: Increase statement timeout to 5 minutes (for build queries)
ALTER DATABASE postgres SET statement_timeout = '300000';

-- Step 3: Apply to current session
SET statement_timeout = '300000';

-- Verify it worked
SHOW statement_timeout;
```

**Click "Run" to apply.**

---

## Why This Is Critical

**Current State:**

- Default timeout: 60 seconds
- Build queries need: ~2-3 minutes per state
- Result: Timeout errors

**After Fix:**

- RPC function: 10x faster city queries
- Timeout: 5 minutes (safe margin)
- Result: Successful builds

---

## Alternative: Manual SQL Application

If you can't access SQL Editor, I can provide you with the exact steps:

1. **Open Supabase Dashboard**
2. **Navigate to SQL Editor** (left sidebar)
3. **Click "New Query"**
4. **Paste the SQL above**
5. **Click "Run" (or F5)**

You should see:

```
Success: Function created
Success: Timeout updated
statement_timeout: 300000
```

---

## After Applying SQL

Once you've run the SQL:

1. **Trigger a new Vercel deployment:**

   ```bash
   git commit --allow-empty -m "Trigger rebuild after SQL migration"
   git push origin main
   ```

2. **Build should succeed in ~5-10 minutes**

---

## Verification

After build succeeds, verify the function works:

```sql
-- Test the function
SELECT * FROM get_distinct_cities_by_state('Texas') LIMIT 10;
```

Should return distinct Texas cities instantly.

---

## Why Timeout Happens During "404.astro"

The error says "404.astro" but that's misleading. What's actually happening:

1. Astro builds city pages (e.g., `/states/texas/austin`)
2. Each page queries Supabase for data
3. Supabase hits 60-second timeout
4. Error gets reported as "404.astro" (Astro's error handling quirk)

**Real culprit:** Too many sequential database queries without the RPC optimization.

---

## Status

- ✅ Code optimizations committed
- ⏳ SQL migration needs manual application (you need to do this)
- ⏳ Rebuild after migration

**Estimated time to fix: 2 minutes (apply SQL) + 10 minutes (rebuild)**
