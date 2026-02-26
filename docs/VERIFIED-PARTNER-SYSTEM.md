# RecycleOldTech.com — Verified Partner / Claimed Listings Feature
## Implementation Reference (Current State)

---

## Overview

The Verified Partner system allows recycling businesses to claim or add their listing, pay a monthly subscription, and receive enhanced visibility, a verified badge, and priority lead routing. This is the primary revenue stream for the site.

The site is built with **Astro (hybrid SSG/SSR)**, uses **Supabase** for the database, and **web3forms** for email notifications on form submissions. All admin functions run client-side against the anon key using `SECURITY DEFINER` SQL functions to safely bypass RLS.

---

## Part 1: Database Schema

### Migrations applied (in order)

| File | Purpose |
|---|---|
| `20260219000000_claims_system.sql` | Creates `business_claims`, `verified_partners`, RLS policies, `claim_summary` view, `get_all_business_claims()`, `update_claim_status()`, `update_claim_notes()` |
| `20260219000001_add_claims_detail_fields.sql` | Adds `description`, `accepted_items`, `services_offered`, `certifications`, `hours` to `business_claims`; updates `get_all_business_claims()` |
| `20260219000002_claim_workflow.sql` | Adds `submission_type` to `business_claims`; adds `approve_claim()` function; updates `get_all_business_claims()` |
| `20260219000003_approve_claim_verified_partners.sql` | Updates `approve_claim()` to also upsert into `verified_partners` for premium/featured tiers |

---

### Table: `business_claims`

Full schema after all migrations:

```sql
create table business_claims (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Business identity
  business_name text not null,
  city text not null,
  state text not null,
  zip text,
  address text,
  phone text,           -- business phone (separate from contact_phone)
  website text,
  google_place_id text,

  -- Listing detail (collected from claim form)
  description text,
  accepted_items text[],    -- e.g. ['Computers & Laptops', 'Phones & Tablets', 'TVs & Monitors']
  services_offered text[],  -- e.g. ['Data Destruction', 'Business Pickup / Collection']
  certifications text[],    -- e.g. ['R2 Certified', 'e-Stewards Certified']
  hours text,               -- free text, e.g. "Mon-Fri 9am-5pm\nSat 9am-1pm"

  -- Claimant contact
  contact_name text not null,
  contact_email text not null,
  contact_phone text,

  -- Whether this is a new listing or an update to an existing one
  submission_type text not null default 'new'
    check (submission_type in ('new', 'update')),

  -- Tier selection
  tier text not null check (tier in ('free', 'premium', 'featured')),

  -- Status tracking
  status text not null default 'pending' check (status in (
    'pending',    -- submitted, not yet reviewed
    'contacted',  -- Adam has reached out
    'active',     -- approved and live in recycling_centers
    'cancelled',  -- churned
    'rejected'    -- not a legit recycler
  )),

  -- Internal use
  notes text,
  message text   -- optional freeform message from the claimant
);
```

### Table: `verified_partners`

Auto-populated by `approve_claim()` for premium and featured tier claims. Free tier claims are not inserted here. Used for displaying the verified badge and enhanced card content on city pages.

```sql
create table verified_partners (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references business_claims(id),
  created_at timestamptz default now(),

  business_name text not null,
  city text not null,
  state text not null,
  address text,
  phone text,
  website text,
  google_place_id text,

  -- Display content
  description text,
  logo_url text,
  accepted_devices text[],
  certifications text[],
  hours text,

  -- Tier and billing
  tier text not null check (tier in ('premium', 'featured')),
  billing_cycle text default 'monthly',
  next_billing_date date,

  -- Visibility controls
  is_active boolean default true,
  is_featured boolean default false,
  priority_cities text[],

  -- Lead routing
  receives_leads boolean default true,
  lead_email text
);
```

### RLS Policies

```sql
-- business_claims: public insert, service_role read/update
alter table business_claims enable row level security;
create policy "Allow public insert" on business_claims for insert with check (true);
create policy "Service role select" on business_claims for select using (auth.role() = 'service_role');
create policy "Service role update" on business_claims for update using (auth.role() = 'service_role');

-- verified_partners: public read active, service_role manages
alter table verified_partners enable row level security;
create policy "Public read active" on verified_partners for select using (is_active = true);
create policy "Service role full access" on verified_partners for all using (auth.role() = 'service_role');
```

---

### SQL Functions

All functions use `SECURITY DEFINER` so they can be called from the client with the anon key.

#### `get_all_business_claims()` → table
Returns all claims ordered by `created_at desc`. Used by the admin page. Includes all columns including the new detail and `submission_type` fields.

#### `update_claim_status(p_claim_id uuid, p_new_status text)` → void
Updates `status` and `updated_at` on a single claim. Called from the admin status dropdown.

#### `update_claim_notes(p_claim_id uuid, p_notes text)` → void
Updates `notes` and `updated_at` on a single claim. Called from the admin notes textarea.

#### `approve_claim(p_claim_id uuid)` → text

The primary publishing function. Writes to `recycling_centers` and, for premium/featured tiers, also upserts into `verified_partners`.

**Logic:**
- If `submission_type = 'update'`: searches `recycling_centers` for a case-insensitive match on `name + city + state`. If found, updates the existing record (preserving any fields not provided). If no match, inserts as new.
- If `submission_type = 'new'`: always inserts a new `recycling_centers` record.
- If `tier IN ('premium', 'featured')`: upserts into `verified_partners` by `claim_id` (insert on first approval, update on re-approval).
- Sets the claim `status` to `'active'`.

**Returns:**
| Value | Meaning |
|---|---|
| `'inserted'` | New listing added to the directory |
| `'updated'` | Existing listing found and updated |
| `'no_match_inserted'` | Update requested but no matching record found — inserted as new |

**Field mapping (`business_claims` → `recycling_centers`):**

| Claim field | recycling_centers field | Notes |
|---|---|---|
| `business_name` | `name` | |
| `address` | `full_address` | |
| `city` | `city` | |
| `state` | `state` | |
| `zip` | `postal_code` | Cast to integer; skipped if not a 5-digit number |
| `phone` | `phone` | |
| `website` | `site` | |
| `description` | `description` | |
| `accepted_items` (TEXT[]) | `accepted_items` (JSONB) | Converted via `to_jsonb()` |
| `services_offered` (TEXT[]) | `services_offered` (JSONB) | Converted via `to_jsonb()` |
| `certifications` (TEXT[]) | `certifications` (JSONB) | Converted via `to_jsonb()` |
| `hours` | `working_hours` | Stored as `{"text": "..."}` JSONB |
| — | `content_enhanced` | Set to `true` |
| — | `content_enhanced_at` | Set to `now()` |

**Field mapping (`business_claims` → `verified_partners`, premium/featured only):**

| Claim field | verified_partners field | Notes |
|---|---|---|
| `business_name` | `business_name` | |
| `city` | `city` | |
| `state` | `state` | |
| `address` | `address` | |
| `phone` | `phone` | |
| `website` | `website` | |
| `description` | `description` | |
| `accepted_items` (TEXT[]) | `accepted_devices` (TEXT[]) | Column name differs — note this |
| `certifications` (TEXT[]) | `certifications` (TEXT[]) | |
| `hours` | `hours` | |
| `tier` | `tier` | Only 'premium' or 'featured' |
| `tier = 'featured'` | `is_featured` | true for featured, false for premium |
| `contact_email` | `lead_email` | |
| — | `receives_leads` | Defaults to true |
| — | `is_active` | Set to true on approval |

---

## Part 2: `recycling_centers` Fields Used for Display

These columns already exist on `recycling_centers` (added by the content enhancement pipeline migration):

```sql
accepted_items   JSONB DEFAULT '[]'  -- populated by AI pipeline for ~93.5% of centers
services_offered JSONB DEFAULT '[]'  -- populated via approve_claim() for verified partners
certifications   JSONB DEFAULT '[]'  -- populated via approve_claim() for verified partners
description      TEXT
working_hours    JSONB
```

**TypeScript type** (`src/types/supabase.ts`):
```ts
accepted_items?:   string[] | null;
services_offered?: string[] | null;
certifications?:   string[] | null;
```

---

## Part 3: Claim Form (`/claim`)

File: `src/pages/claim.astro`

### Page Sections

1. **Hero** — Direct headline, no badge/pill element
2. **Why Claim Your Listing** — Three value prop cards
3. **Example Verified Listing** — A static mock of a real `CenterCard` with the verified badge shown, so businesses can see exactly how they'll appear to customers
4. **Pricing Tiers** — Free ($0) / Premium ($15/mo, highlighted) / Featured ($30/mo)
5. **Claim Form**

### Form Fields

Organized into labeled sections:

**Business Information**
- Business Name (required)
- Street Address (optional)
- City (required), State dropdown (required)
- ZIP Code (optional), Business Phone (optional)
- Website (optional)

**Your Contact Information**
- Your Name (required)
- Email Address (required), Your Phone (optional)

**What Do You Accept?** (required — at least one)
Checkboxes: Computers & Laptops, Phones & Tablets, TVs & Monitors, Printers & Scanners, Gaming Consoles, Audio / Video Equipment, Batteries, Small Electronics & Cables, Hard Drives & Storage Media, Servers & Networking Equipment

**Services Offered** (optional checkboxes)
Free Drop-off Recycling, Data Destruction, Certificate of Destruction, Business Pickup / Collection, Mail-in Program, ITAD (IT Asset Disposition), We Pay for Certain Items

**Certifications** (optional checkboxes)
R2 Certified, e-Stewards Certified, NAID AAA Certified, ISO 14001, RIOS Certified

**Additional Details**
- Business Hours (textarea — free text)
- Business Description (textarea — shown on listing)

**Plan** — Free / Premium $15/mo / Featured $30/mo (radio buttons)

**Anything else** — Optional freeform message

### New vs. Update Toggle

At the top of the form card, before the heading, there is a segmented toggle:

- **"No, Add New Listing"** (default) — sets `submission_type = 'new'`
- **"Yes, Update My Listing"** — sets `submission_type = 'update'`

Switching modes updates the form title, description copy, submit button label, and the web3forms email subject line. The `submission_type` value is sent to both web3forms and Supabase.

### Submission

On submit, the form:
1. Validates required fields (including at least one accepted item checkbox)
2. POSTs to web3forms for email notification
3. Inserts into `business_claims` via the Supabase REST API (`/rest/v1/business_claims`)
4. Shows an inline success state (form card hidden, success card shown)

### Pre-fill from Query Params

`?business=`, `?city=`, `?state=` — pre-fill the corresponding fields (used by "Claim this listing" links on city pages).
`?mode=update` — pre-selects the "Yes, Update My Listing" toggle.

---

## Part 4: Admin Page (`/admin/claims`)

File: `src/pages/admin/claims.astro`

Password-gated via `sessionStorage`. Password sourced from `PUBLIC_ADMIN_PASSWORD` env var (fallback: `recycleadmin2026`). URL: `/admin/claims`.

### Features

- Stats row: Total, Pending, Contacted, Active, Rejected counts
- Table: Business name, **New/Update badge** (blue/purple), Location, Contact, Tier, Status, Submitted
- Status dropdown on each row → calls `update_claim_status()` RPC
- Click any row → opens detail modal
- **Log Out** button (top-right, red) → clears `sessionStorage` and returns to password gate

### Detail Modal

Shows all claim fields in labeled sections:
- Business Info (name, location, address, phone, website)
- Contact (name, email, phone)
- Listing Details — accepted items (green tags), services (blue tags), certifications (amber tags), hours, description
- Submission (plan, status, date, message)
- Internal Notes (textarea + Save button → `update_claim_notes()`)
- **"Approve & Publish to Directory"** button → calls `approve_claim()` RPC, shows the result message (`inserted` / `updated` / `no_match_inserted`), updates the row status to `active`

---

## Part 5: CenterCard Display (`src/components/recycling-centers/CenterCard.astro`)

### Accepted Items — all cards

A `parseJsonArray()` helper safely parses the JSONB field (handles JS arrays, JSON strings, or null). Up to 5 items shown as gray tags below the star rating, with "+N more" if there are additional items. ~93.5% of existing centers have this data from the AI pipeline.

### Services Offered — verified partners only

Blue tags shown after the description, with a checklist icon. Only rendered when `verifiedPartner` prop is non-null.

### Certifications — verified partners only

Amber tags shown after services, with a badge icon. Only rendered when `verifiedPartner` prop is non-null.

---

## Part 6: Verified Badge Component

File: `src/components/VerifiedBadge.astro`

Props: `tier?: 'premium' | 'featured'`, `size?: 'sm' | 'md'`

- Premium: green background (`bg-green-50 text-green-800 border-green-300`), label "Verified Partner"
- Featured: amber background (`bg-amber-50 text-amber-800 border-amber-300`), label "Featured Partner"

The badge is also rendered inline in `CenterCard.astro` (not via the component) for the verified partner block.

---

## Part 7: Navigation & Footer

- **Header** (`src/components/Header.astro`): "For Businesses" button (green pill) in desktop nav, links to `/claim`
- **Footer** (`src/components/Footer.astro`): "For Businesses" column with Claim Your Listing, Verified Partner Program, Contact Us

---

## Environment Variables

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_ADMIN_PASSWORD=       # used by /admin/claims
```

---

## Files Created / Modified

| File | Status |
|---|---|
| `src/pages/claim.astro` | Created |
| `src/pages/admin/claims.astro` | Created |
| `src/components/VerifiedBadge.astro` | Created |
| `src/components/recycling-centers/CenterCard.astro` | Modified |
| `src/components/Header.astro` | Modified |
| `src/components/Footer.astro` | Modified |
| `src/types/supabase.ts` | Modified |
| `supabase/migrations/20260219000000_claims_system.sql` | Created |
| `supabase/migrations/20260219000001_add_claims_detail_fields.sql` | Created |
| `supabase/migrations/20260219000002_claim_workflow.sql` | Created |
| `supabase/migrations/20260219000003_approve_claim_verified_partners.sql` | Created |

---

## Definition of Done

- [x] `/claim` page live with working form that inserts to `business_claims`
- [x] New vs. Update toggle with `submission_type` field
- [x] All listing detail fields collected (accepted items, services, certifications, hours, description)
- [x] Claim form pre-fills from query params (`?business=`, `?city=`, `?state=`, `?mode=update`)
- [x] Success state shown after submission
- [x] Verified badge component exists and renders correctly
- [x] City pages show verified badge for active `verified_partners` records
- [x] Accepted items shown on all listing cards
- [x] Services and certifications shown on verified partner cards only
- [x] Admin page at `/admin/claims` with password gate
- [x] Admin can approve a claim → publishes directly to `recycling_centers` via `approve_claim()`
- [x] `approve_claim()` auto-upserts into `verified_partners` for premium/featured tiers — verified badge shows automatically after approval
- [x] Admin page has Log Out button to end session
- [x] Footer has "For Businesses" section

---
---

# Outreach Plan: Getting Recyclers to Claim Listings

## Goal
Convert recycling businesses already in the directory into paying Verified Partners. Target: 15-20 paying customers at $15/mo = $225-300/mo recurring within 60 days.

---

## Tier 1: Warm Outreach (Highest Priority)

These are recyclers who have already interacted with RecycleOldTech in some way. Contact these first.

**Who they are:**
- Andrew from Flathead E-Waste Recycling (Kalispell, MT) — already asked about supporting you
- Any recycler you've previously referred a lead to
- Any recycler who has emailed you directly

**Approach:** Personal email, reference the specific interaction. Do not pitch pricing in the first email. Get on a call.

---

## Tier 2: High-Traffic City Outreach

Pull the top 20-30 cities from your analytics (Google Analytics or Supabase query on city page views). Target the top-rated recycler in each of those cities.

**Why top-rated:** They're more likely to have budget, they have reputation to protect, and a verified badge reinforces something they already care about.

**Selection criteria:**
- 4.0+ star rating
- Has a website (indicates some business sophistication)
- Has been in business 2+ years if visible
- Ideally in a state with e-waste laws (NY, CA, WA, IL, TX) — recyclers in regulated states have more motivation to look legitimate

---

## Email Templates

### Template A: Warm Outreach (Andrew / Prior Lead Recipients)

> Subject: Your free listing on RecycleOldTech.com
>
> Hi [Name],
>
> [Personalized opener — e.g. "It was great hearing from you last week" or "I've sent a few leads your way recently from people in the Kalispell area."]
>
> I wanted to let you know we just launched a Verified Partner program on the site. Essentially it gives your listing a verified badge, moves you to the top of your city's results, and routes leads directly to you rather than going through a generic form.
>
> Given that you're already on the site, I'd love to get you set up — even just on the free tier to start. If you want to hop on a quick call I can walk you through it.
>
> Any time after [your availability] works for me.
>
> Adam
> RecycleOldTech.com

---

### Template B: Cold Outreach to Top-Rated Recyclers

> Subject: Your business on RecycleOldTech.com
>
> Hi [Name],
>
> I run RecycleOldTech.com, a nationwide electronics recycling directory getting about 15,000 visitors a month. [Business Name] is already listed on the site — people in [City] searching for recyclers are finding you there.
>
> We just launched a Verified Partner program. It puts a verification badge on your listing, moves you to the top of the [City] results page, and routes people who fill out our contact form directly to your inbox.
>
> Premium tier is $15/month, no contract. Would it be useful to get on a quick call to see if it's a fit?
>
> Adam
> RecycleOldTech.com

---

### Template C: Follow-Up (7 Days After No Response)

> Subject: Re: Your business on RecycleOldTech.com
>
> Hi [Name],
>
> Just following up on my note from last week. Happy to answer any questions or just set you up on the free tier if you'd like to try the directory without any commitment.
>
> Adam

---

### Template D: Response to Businesses Who Reach Out First (Like Andrew)

> Subject: Re: [Their subject line]
>
> Hi [Name],
>
> Great to hear from you. We actually just launched a Verified Partner program that sounds like exactly what you're looking for.
>
> Rather than go back and forth over email, would it be easier to jump on a quick call? I can show you how the listing looks and walk through the options. I'm flexible — any time after [your availability] works for me.
>
> Adam
> RecycleOldTech.com

---

## Outreach Cadence

| Day | Action |
|---|---|
| Day 1 | Send Template A to all warm contacts |
| Day 1-3 | Identify top recycler in each of your top 20 traffic cities |
| Day 3-5 | Send Template B to cold outreach batch (10-15 at a time, not all at once) |
| Day 10 | Send Template C follow-up to anyone who hasn't responded |
| Ongoing | Any new inbound (form submission, direct email) gets Template D within 24 hours |

Do not send more than 15-20 cold outreach emails per week. Keep it personal enough that it doesn't feel like spam.

---

## Tracking

Use the `/admin/claims` page for inbound form submissions. Track cold outreach separately in a simple spreadsheet:

| Business Name | City | State | Contact Email | Tier Interest | Date Contacted | Status | Notes |
|---|---|---|---|---|---|---|---|

Status options: `contacted` / `responded` / `call scheduled` / `active` / `not interested` / `follow up`

---

## Realistic Targets

| Timeframe | Goal |
|---|---|
| Week 1-2 | 1-2 paying customers (Andrew + 1 from warm outreach) |
| Month 1 | 5-8 paying customers |
| Month 2 | 10-15 paying customers |
| Month 3 | 15-25 paying customers = $225-375/mo recurring |

The claimed listings revenue compounds as more recyclers see the badge on competitors' listings and want one too. Andrew is the most important first customer because he can become a reference.
