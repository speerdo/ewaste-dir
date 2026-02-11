# Supabase database schema (e-waste directory)

Schema is defined by migrations in `supabase/migrations/`. This document is the consolidated reference as of the latest migrations.

---

## Tables

### `states`
| Column       | Type      | Constraints | Description                    |
|-------------|-----------|-------------|--------------------------------|
| id          | text      | PRIMARY KEY | State identifier               |
| name        | text      | NOT NULL    | State name                     |
| description | text      |             | State description             |
| image_url   | text      |             | Image URL                      |
| featured    | boolean   | DEFAULT false | Whether state is featured   |
| created_at  | timestamptz | DEFAULT now() | Created timestamp          |
| updated_at  | timestamptz | DEFAULT now() | Updated timestamp          |

- **RLS:** enabled  
- **Policy:** Public read (SELECT) for all

---

### `cities`
| Column                 | Type      | Constraints | Description                          |
|------------------------|-----------|-------------|--------------------------------------|
| id                     | text      | PRIMARY KEY | City identifier                      |
| state_id               | text      | FK → states(id) ON DELETE CASCADE | State reference   |
| name                   | text      | NOT NULL    | City name                            |
| description            | text      |             | City / AI-generated description     |
| address                | text      |             | Address                              |
| lat                    | numeric   |             | Latitude                             |
| lng                    | numeric   |             | Longitude                            |
| image_url              | text      |             | Image URL                            |
| description_verified  | boolean   | DEFAULT false | Description verified flag          |
| description_generated_at | timestamptz |         | When description was generated       |
| description_verified_at  | timestamptz |         | When description was verified        |
| description_source    | text      |             | AI provider: openai, anthropic, gemini |
| recycling_center_count | integer  | DEFAULT 0   | Count of recycling centers           |
| population             | integer  |             | Population                           |
| created_at             | timestamptz | DEFAULT now() | Created timestamp                 |
| updated_at             | timestamptz | DEFAULT now() | Updated timestamp                 |

- **RLS:** enabled  
- **Policy:** Public read (SELECT) for all

---

### `recycling_centers`
| Column                    | Type           | Constraints | Description |
|---------------------------|----------------|-------------|-------------|
| id                        | uuid           | PRIMARY KEY, DEFAULT gen_random_uuid() | Row ID |
| name                      | text           | NOT NULL    | Business name |
| site                      | text           |             | Website URL |
| phone                     | text           |             | Phone |
| full_address              | text           |             | Full address |
| city                      | text           |             | City |
| postal_code               | integer        |             | ZIP/postal code |
| state                     | text           |             | State |
| latitude                  | numeric        |             | Latitude |
| longitude                 | numeric        |             | Longitude |
| rating                    | numeric        |             | Rating |
| reviews                   | numeric        |             | Review count |
| photo                     | text           |             | Photo URL |
| logo                      | text           |             | Logo URL |
| description               | text           |             | Description |
| working_hours             | jsonb          |             | Hours (flexible structure) |
| location                  | geography(POINT, 4326) |   | PostGIS point (from lat/lng) |
| legitimacy_score          | integer        |             | Legitimacy score (higher = more legitimate) |
| legitimacy_reason         | text           |             | Explanation of score |
| is_legitimate             | boolean        |             | Legitimate recycling business flag |
| is_suspicious             | boolean        |             | Possibly not a recycling center |
| scraped_at                | timestamptz    |             | Last scrape time |
| accepted_items            | jsonb          | DEFAULT '[]' | Accepted electronics types |
| rejected_items            | jsonb          | DEFAULT '[]' | Rejected items |
| services_offered          | jsonb          | DEFAULT '[]' | e.g. data destruction, ITAD, pickup |
| certifications            | jsonb          | DEFAULT '[]' | e.g. R2, e-Stewards, NAID |
| preparation_instructions  | text           |             | How to prepare items |
| accessibility_info       | text           |             | Accessibility info |
| content_enhanced          | boolean        | DEFAULT false | Content enhanced for AdSense |
| content_enhanced_at       | timestamptz    |             | Last content enhancement time |
| excluded_specialties      | jsonb          | DEFAULT '[]' | Specialty tags to exclude from display |
| created_at                | timestamptz    | DEFAULT now() | Created |
| updated_at                | timestamptz    | DEFAULT now() | Updated |

- **RLS:** enabled  
- **Policy:** Public read (SELECT) for all  
- **Trigger:** `trigger_update_content_enhanced_timestamp` sets `content_enhanced_at` when `content_enhanced` becomes true

---

### `local_regulations`
| Column                | Type      | Constraints | Description |
|-----------------------|-----------|-------------|-------------|
| id                    | uuid      | PRIMARY KEY, DEFAULT gen_random_uuid() | Row ID |
| city_state            | text      | NOT NULL UNIQUE | City-state key (e.g. "Austin_TX") |
| state_code            | text      | NOT NULL    | State code |
| city_name             | text      | NOT NULL    | City name |
| has_ewaste_ban        | boolean   | DEFAULT false | E-waste ban in effect |
| landfill_restrictions | text      |             | Landfill rules |
| battery_regulations   | text      |             | Battery rules |
| tv_computer_rules     | text      |             | TV/computer rules |
| business_requirements| text      |             | Business requirements |
| penalties_fines       | text      |             | Penalties/fines |
| municipal_programs    | text      |             | Municipal programs |
| special_events        | text      |             | Special events |
| drop_off_locations    | text      |             | Drop-off locations |
| environmental_benefits| text      |             | Environmental benefits |
| government_website    | text      |             | Government site URL |
| recycling_hotline     | text      |             | Hotline |
| created_at            | timestamptz | DEFAULT now() | Created |
| updated_at            | timestamptz | DEFAULT now() | Updated |

- **RLS:** enabled  
- **Policy:** Public read (SELECT) for all

---

### `city_stats`
| Column                 | Type      | Constraints | Description |
|------------------------|-----------|-------------|-------------|
| id                     | uuid      | PRIMARY KEY, DEFAULT gen_random_uuid() | Row ID |
| city_state             | text      | NOT NULL UNIQUE | City-state key |
| population             | integer   |             | Population |
| recycling_rate         | text      |             | Recycling rate |
| ewaste_per_capita      | integer   |             | E-waste per capita |
| co2_savings_lbs        | integer   |             | CO₂ savings (lbs) |
| metals_recovered_lbs   | integer   |             | Metals recovered (lbs) |
| plastics_recycled_lbs  | integer   |             | Plastics recycled (lbs) |
| jobs_supported         | integer   |             | Jobs supported |
| economic_impact_dollars| integer   |             | Economic impact ($) |
| created_at             | timestamptz | DEFAULT now() | Created |
| updated_at             | timestamptz | DEFAULT now() | Updated |

- **RLS:** enabled  
- **Policy:** Public read (SELECT) for all

---

## Views

### `enhanced_content_report`
Aggregates content enhancement status by city (for AdSense compliance):

- `state`, `city`
- `total_centers` – count of centers
- `enhanced_centers` – count with `content_enhanced = true`
- `pending_enhancement` – count with `content_enhanced = false`
- `enhancement_percentage`

Only rows where `city` and `state` are not null. Ordered by `enhancement_percentage` DESC, then `total_centers` DESC.

---

## Functions (RPC)

| Function | Returns | Description |
|----------|---------|-------------|
| `get_all_city_states()` | TABLE (state text, city text, count bigint) | All distinct (state, city) from `recycling_centers` with counts. SECURITY DEFINER. |
| `get_distinct_cities_by_state(state_name TEXT)` | TABLE (city text) | Distinct cities for a given state (ILIKE match). STABLE. |
| `get_cities_description_stats()` | TABLE (total_cities, cities_with_descriptions, verified_descriptions, pending_verification, avg_description_length) | Stats for city descriptions. STABLE. |
| `update_content_enhanced_timestamp()` | trigger | Sets `content_enhanced_at` when `content_enhanced` becomes true. |

---

## Extensions

- **postgis** – used for `recycling_centers.location` (GEOGRAPHY)
- **pg_trgm** – used for trigram indexes on `recycling_centers` (state, city, full_address) for ILIKE

---

## Indexes (summary)

- **recycling_centers:** state, city, full_address (trigram + btree), location (GIST), legitimacy, content_enhanced, services_offered/certifications/excluded_specialties (GIN), plus performance indexes from the optimize migration.
- **cities:** state_id, (state_id, id), (state_id, id, description_verified), description_verified, description null/verified.
- **states:** featured.
- **local_regulations:** city_state, state_code.
- **city_stats:** city_state.

---

## Where the schema lives

- **Source of truth:** `supabase/migrations/*.sql` (apply in filename order).
- **This doc:** `docs/DATABASE_SCHEMA.md` – human-readable snapshot; for the exact current schema in Supabase, use the Dashboard or `supabase db dump` / generated types.

To regenerate TypeScript types from your live project:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

Or use the Supabase MCP/server to generate types for the linked project.
