-- Adds a column for AI-generated, state-specific prose to replace the
-- hardcoded boilerplate previously duplicated across all 51 state pages
-- in StateDescription.astro.
alter table public.states
  add column if not exists extended_content jsonb;

comment on column public.states.extended_content is
  'AI-generated, state-specific prose blocks (why_it_matters, certified_recyclers_intro, environmental_benefits_intro, getting_started_intro, business_recycling_intro, business_benefits_intro) rendered on the state page in place of generic boilerplate.';
