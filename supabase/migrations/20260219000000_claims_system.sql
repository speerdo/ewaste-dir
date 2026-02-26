-- ============================================================
-- Claims System: business_claims + verified_partners
-- Created: 2026-02-19
-- ============================================================

-- --------------------------------------------------------
-- Table: business_claims
-- --------------------------------------------------------
create table if not exists business_claims (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Business identity
  business_name text not null,
  city text not null,
  state text not null,
  zip text,
  address text,
  phone text,
  website text,
  google_place_id text,

  -- Claimant contact
  contact_name text not null,
  contact_email text not null,
  contact_phone text,

  -- Tier selection
  tier text not null check (tier in ('free', 'premium', 'featured')),

  -- Status tracking
  status text not null default 'pending' check (status in (
    'pending',
    'contacted',
    'active',
    'cancelled',
    'rejected'
  )),

  -- Notes for internal use
  notes text,

  -- Optional message from claimant
  message text
);

-- --------------------------------------------------------
-- Table: verified_partners (active paying customers)
-- --------------------------------------------------------
create table if not exists verified_partners (
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

-- --------------------------------------------------------
-- Row Level Security: business_claims
-- --------------------------------------------------------
alter table business_claims enable row level security;

create policy "Allow public insert on business_claims"
  on business_claims for insert
  with check (true);

create policy "Service role select on business_claims"
  on business_claims for select
  using (auth.role() = 'service_role');

create policy "Service role update on business_claims"
  on business_claims for update
  using (auth.role() = 'service_role');

-- --------------------------------------------------------
-- Row Level Security: verified_partners
-- --------------------------------------------------------
alter table verified_partners enable row level security;

create policy "Public read active verified_partners"
  on verified_partners for select
  using (is_active = true);

create policy "Service role full access on verified_partners"
  on verified_partners for all
  using (auth.role() = 'service_role');

-- --------------------------------------------------------
-- View: claim_summary
-- --------------------------------------------------------
create or replace view claim_summary as
select
  tier,
  status,
  count(*) as count,
  min(created_at) as oldest,
  max(created_at) as newest
from business_claims
group by tier, status
order by tier, status;

-- --------------------------------------------------------
-- Admin helper: read all claims (bypasses RLS via SECURITY DEFINER)
-- Called from the client-side admin page with the anon key.
-- The admin page has a client-side password gate.
-- --------------------------------------------------------
create or replace function get_all_business_claims()
returns table (
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
  notes text
)
language sql
security definer
set search_path = public
as $$
  select
    id, created_at, updated_at,
    business_name, city, state, zip, address, phone, website,
    tier, status,
    contact_name, contact_email, contact_phone,
    message, notes
  from business_claims
  order by created_at desc;
$$;

-- --------------------------------------------------------
-- Admin helper: update claim status (bypasses RLS via SECURITY DEFINER)
-- --------------------------------------------------------
create or replace function update_claim_status(p_claim_id uuid, p_new_status text)
returns void
language sql
security definer
set search_path = public
as $$
  update business_claims
  set status = p_new_status, updated_at = now()
  where id = p_claim_id;
$$;

-- --------------------------------------------------------
-- Admin helper: update claim notes
-- --------------------------------------------------------
create or replace function update_claim_notes(p_claim_id uuid, p_notes text)
returns void
language sql
security definer
set search_path = public
as $$
  update business_claims
  set notes = p_notes, updated_at = now()
  where id = p_claim_id;
$$;
