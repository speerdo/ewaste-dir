# Apply Database Performance Indexes

## Quick Method: Supabase Dashboard (Recommended - 2 minutes)

This is the fastest and most reliable method:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste**
   - Open: `supabase/migrations/20250103000000_optimize_build_performance_indexes.sql`
   - Copy the entire contents
   - Paste into SQL Editor

4. **Run**
   - Click "Run" (or press F5)
   - Wait for completion (~30 seconds to 2 minutes)

5. **Verify**
   ```sql
   -- Check if indexes were created
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'recycling_centers' 
   AND indexname LIKE '%trgm%';
   ```

✅ **Done!** Your database is now optimized.

---

## CLI Method (If you prefer)

### Step 1: Link Your Project (One-time setup)

```bash
# Get your project reference ID from:
# - Supabase Dashboard → Settings → General → Reference ID
# - Or from URL: https://[PROJECT_REF].supabase.co

supabase link --project-ref YOUR_PROJECT_REF
# Enter your database password when prompted
```

### Step 2: Push Migration

```bash
cd /home/adam/Projects/ewaste-dir
export PATH="$HOME/.local/bin:$PATH"  # If Supabase CLI is in ~/.local/bin
supabase db push
```

Or use the helper script:
```bash
./scripts/apply-indexes-via-cli.sh
```

---

## What This Does

- ✅ Adds trigram indexes for ILIKE queries (10-100x faster)
- ✅ Adds composite indexes for combined queries
- ✅ Updates query statistics
- ✅ **Cost: $0** (uses included disk space)
- ✅ **Expected improvement: 50-80% faster builds**

---

## Troubleshooting

### "Extension pg_trgm does not exist"
- This is normal on some Supabase projects
- The migration will create it automatically
- If it fails, run this first:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```

### "Permission denied"
- Make sure you're using a service role key or have admin access
- For dashboard method, you need project owner/admin access

### "Index already exists"
- This is fine - the migration uses `IF NOT EXISTS`
- It will skip existing indexes

---

## Verification

After applying, test query performance:

```sql
-- This should use the trigram index (check with EXPLAIN)
EXPLAIN ANALYZE 
SELECT * FROM recycling_centers 
WHERE state ILIKE 'Texas' 
LIMIT 10;
```

Look for: `Index Scan using idx_recycling_centers_state_trgm`

---

## Next Steps

After applying indexes:
1. ✅ Run a test build to see performance improvement
2. ✅ Monitor build times (should be 50-60% faster)
3. ✅ Check Vercel build logs for query performance

Expected results:
- Build time: 30+ min → 10-15 min
- Query speed: 10-100x faster on ILIKE queries
- Cost: No increase (uses included resources)

