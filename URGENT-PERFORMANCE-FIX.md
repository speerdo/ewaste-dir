# Urgent: Build Still Slow After Indexes

## The Real Problem

The indexes help individual queries, but the **real bottleneck** is:

1. **Multiple queries per city page** - `getRecyclingCentersByCity()` tries 5-10 city name variations in a loop
2. **Sequential processing** - 3,970 pages × multiple queries each = 10,000+ queries
3. **No batching** - Each page makes separate queries instead of batching

## Quick Diagnosis

Run this in Supabase SQL Editor to check if indexes are being used:

```sql
-- Check if indexes exist and are being used
SELECT 
  indexname,
  idx_scan as times_used,
  CASE 
    WHEN idx_scan = 0 THEN '❌ NOT USED'
    ELSE '✅ USED'
  END as status
FROM pg_stat_user_indexes
WHERE tablename = 'recycling_centers'
  AND indexname LIKE '%trgm%'
ORDER BY idx_scan DESC;
```

If `idx_scan = 0`, the indexes aren't being used. This could mean:
- Query planner needs updated statistics
- Indexes weren't created properly
- Connection is using a different database/schema

## Immediate Fixes

### 1. Update Statistics (Critical!)

```sql
-- Force PostgreSQL to update query statistics
ANALYZE recycling_centers;
ANALYZE cities;
ANALYZE local_regulations;
ANALYZE city_stats;

-- Check last analyze time
SELECT 
  schemaname,
  tablename,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('recycling_centers', 'cities');
```

### 2. Verify Indexes Were Created

```sql
-- List all trigram indexes
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'recycling_centers' 
  AND indexname LIKE '%trgm%';
```

You should see:
- `idx_recycling_centers_state_trgm`
- `idx_recycling_centers_city_trgm`
- `idx_recycling_centers_state_city_trgm`
- `idx_recycling_centers_full_address_trgm`

### 3. Test Query Performance

```sql
-- This should use the trigram index
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM recycling_centers 
WHERE state ILIKE 'Texas'
LIMIT 10;
```

Look for: `Index Scan using idx_recycling_centers_state_trgm`

If you see `Seq Scan` instead, the index isn't being used.

## The Real Solution: Reduce Query Count

Even with fast indexes, **3,970 pages × 5 queries each = 19,850 queries** is too many.

### Option 1: Batch Pre-fetch (Best Solution)

Pre-fetch all data in `getStaticPaths()` and pass via props. This reduces queries from 19,850 to ~100.

### Option 2: Optimize City Name Matching

Instead of trying 5-10 variations per city, use a single optimized query:

```typescript
// Instead of looping through variations, use a single query with OR
const { data } = await supabase
  .from('recycling_centers')
  .select('*')
  .ilike('state', state.name)
  .or(cityVariants.map(v => `city.ilike.${v}`).join(','))
  .order('name');
```

### Option 3: Use Materialized Views

Pre-compute city-center mappings in a materialized view, refresh during off-hours.

## Next Steps

1. **Run the diagnostic queries above** to see if indexes are being used
2. **Run ANALYZE** to update statistics
3. **Check Vercel build logs** to see which queries are slow
4. **Consider batching** - the real fix is reducing query count, not just speeding them up

## Expected Results After ANALYZE

- Individual ILIKE queries: 50-200ms (down from 2-5 seconds)
- But build time: Still 15-20 minutes (because of query count)

**The indexes help, but you need to reduce the number of queries to see major build time improvements.**


