# RecycleOldTech.com — /claim Page Conversion Redesign
## Cursor Implementation Prompt

---

## Context

The `/claim` page is receiving approximately 1,200 visitors per week but converting almost none of them into paid Verified Partners. The core problems are:

1. **Wrong audience landing here** — most visitors are consumers, not recyclers. The page needs to immediately self-select for business owners.
2. **Pricing tiers look identical** — Free, Premium, and Featured all show the same bullet list with no visual differentiation. A recycler cannot tell why they should pay.
3. **The form is too long for a cold visitor** — 10 sections of fields before they've decided they want this.
4. **False social proof** — "Trusted by recyclers in 12 states" is not yet true. Remove it.
5. **No urgency or specificity** — the page could be for any directory. It doesn't speak to recyclers specifically.

The real sales motion for this product is: recycler finds their listing on a city page → clicks "Claim this listing" → lands here → fills out a short interest form → Adam follows up personally and closes them. The page should support that motion, not try to replace it with a long form.

---

## Design Direction

The page should feel like a **professional B2B sales page**, not a consumer landing page. Think clean, confident, and direct. Dark green as the primary accent (already established in the site's "For Businesses" button). Trust signals front and center. No fluff.

Match the existing site's Tailwind CSS styling. Do not introduce new CSS frameworks or override global styles.

---

## Part 1: Hero Section — Rewrite

Replace the current hero with one that immediately speaks to business owners, not consumers.

**Current headline:** "Get Your Recycling Business in Front of Local Customers"

**New headline:** "Your Business Is Already Listed. Make It Work For You."

**New subhead:** "15,000 people search RecycleOldTech every month looking for recyclers near them. Verified Partners appear at the top of every city page and receive leads directly in their inbox."

Add a single CTA button below the subhead: **"See If Your Business Is Listed →"** that smooth-scrolls down to the form.

Remove the "Trusted by recyclers in 12 states" line entirely.

---

## Part 2: Why Claim — Keep But Tighten

Keep the three value prop cards (More Visibility, Qualified Leads, Trust Signal) but make the copy more specific to recyclers.

Update the copy:

- **More Visibility**: "Verified badge on your listing. You appear above unverified businesses on every city page in your area — including competitors."
- **Qualified Leads**: "People who fill out our recycling request form get matched to verified recyclers first. Unverified listings don't receive these leads."
- **Trust Signal**: "The verified badge signals to consumers that you're a legitimate, active business — not an outdated listing. Especially important for first-time visitors deciding who to call."

---

## Part 3: Example Listing — Keep As-Is

The mock listing card showing "Green Earth Electronics Recycling" with the Verified Partner badge is effective. Keep it. Just make sure the badge styling matches the live `VerifiedBadge.astro` component (green for Premium, amber for Featured).

---

## Part 4: Pricing Tiers — Critical Fix

This is the most important change on the page. The three tiers currently show identical bullet lists. A recycler scanning this cannot tell why they should pay.

Redesign the pricing cards so Free vs. Premium vs. Featured is visually unmistakable.

### Free — $0/mo
Label: "Basic Listing"
Subtext: "You're already here. No action needed."
Features (shown as plain gray text, no checkmarks):
- Listed in directory
- ~~Verified badge~~ (strike through, grayed out)
- ~~Priority placement~~ (strike through, grayed out)
- ~~Leads routed to you~~ (strike through, grayed out)
- ~~Top of city page~~ (strike through, grayed out)
- ~~Custom description~~ (strike through, grayed out)
- ~~Logo on listing~~ (strike through, grayed out)

CTA button: "Already Listed — Upgrade" (outlined, not filled)

### Premium — $15/mo
Label: "Verified Partner" with green badge
Subtext: "Everything you need to stand out and win leads."
"Most Popular" pill in top right corner
Features (green checkmarks):
- Listed in directory ✓
- Verified badge ✓
- Priority placement in city results ✓
- Leads routed directly to your inbox ✓
- Custom description on your listing ✓
- Logo on listing ✓
- ~~Top of city page~~ (strike through — Featured only)

CTA button: "Start Premium — $15/mo" (solid green, filled)

### Featured — $30/mo
Label: "Featured Partner" with amber badge
Subtext: "Maximum visibility. Own the top spot."
Features (amber checkmarks):
- Everything in Premium ✓
- Top of city page — above all other listings ✓
- Exclusive top spot (one per city) ✓

CTA button: "Start Featured — $30/mo" (solid amber, filled)

**Visual treatment:** Premium card should have a green border and slight shadow to make it pop. Featured should have amber border. Free should look clearly "lesser" — lighter border, grayed palette.

Below the pricing cards, keep: "All paid plans are month-to-month. No contracts. Cancel anytime."

---

## Part 5: Two-Stage Form — Most Important Structural Change

Replace the single long form with a two-stage experience.

### Stage 1: Short Interest Form (shown first, above the fold)

Heading: **"Claim or Update Your Listing"**
Subheading: "Start here — takes 60 seconds. We'll follow up within 1 business day."

Fields (just 5):
- Business Name (required)
- City (required)
- State dropdown (required)
- Your Email (required)
- Which plan interests you? (radio: Free / Premium $15/mo / Featured $30/mo)

Submit button: **"Claim My Listing →"**

On submit:
- POST to Supabase `business_claims` table with `submission_type = 'new'`, status = 'pending', and a note that this was a short-form submission
- Also fire web3forms notification to Adam
- Hide the short form, show a success message: "Got it! Check your inbox — we'll be in touch within 1 business day to get your listing set up."

### Stage 2: Full Detail Form (below, separated by a divider)

Add a heading above it: **"Already know what you want? Fill out the full form below and we'll set everything up faster."**

Keep the existing full form exactly as it is (all the accepted items checkboxes, services, certifications, hours, description, etc.). This is for recyclers who came from a city page link with pre-filled params and are ready to commit.

The `?business=`, `?city=`, `?state=`, `?mode=update` query param pre-fill behavior should apply to BOTH the short form and the full form.

---

## Part 6: Add a FAQ Section

Add a short FAQ section between the pricing tiers and the form. This addresses objections that are killing conversions silently.

**FAQ items:**

**Q: My business is already listed — do I need to do anything?**
A: Not for the basic free listing. But if you want the verified badge, priority placement, and leads routed to you, you'll need to claim it. Takes about 60 seconds.

**Q: How does billing work?**
A: We reach out after you submit to confirm your details. You won't be charged until we've talked and you're happy with how your listing looks. Month-to-month, cancel anytime.

**Q: What if my listing information is wrong?**
A: That's actually a great reason to claim it. Verified Partners can submit corrections and updates to their listing at any time.

**Q: How many leads can I expect?**
A: It depends on your city and what you accept. We route all recycling request form submissions from your city/region to verified recyclers first. Unverified listings don't receive these.

**Q: Is there a contract?**
A: No. Month-to-month. Cancel from your account or just email us.

Style as a simple accordion or clean Q&A list. No need for fancy animation.

---

## Part 7: Remove or Relocate

- **Remove** the "Trusted by recyclers in 12 states" line from the hero (not yet accurate)
- **Remove** or make subtle any consumer-facing language that would confuse a recycler landing here (e.g., references to "finding a recycler near you")
- The page should feel like it was built exclusively for business owners, not dual-purpose

---

## Part 8: Page Flow After Changes

The final page order should be:

1. Hero (new copy, single CTA scroll button)
2. Why Claim (three value prop cards, updated copy)
3. Example Verified Listing (mock card with badge)
4. Pricing Tiers (redesigned with visual differentiation)
5. FAQ (new section)
6. Short Interest Form (Stage 1 — primary CTA)
7. Divider + "Want to provide more detail?"
8. Full Detail Form (Stage 2 — existing form)
9. Footer

---

## Technical Notes

- This is an Astro page (`src/pages/claim.astro`) using Tailwind CSS
- Match existing site color variables and component styles
- The `VerifiedBadge.astro` component already exists — use it in the pricing tier cards
- Both forms submit to `business_claims` via Supabase REST API and web3forms
- The short form submission should include a `notes` field value of `"Short form submission — follow up required"` so Adam can identify these in the admin panel
- Query param pre-fill (`?business=`, `?city=`, `?state=`, `?mode=update`) should populate fields in both forms
- Do not change the admin page, Supabase schema, or any other files

---

## Definition of Done

- [ ] Hero has new copy and no false social proof claims
- [ ] Pricing tiers are visually distinct — Free looks clearly lesser, Premium has green border and "Most Popular", Featured has amber border
- [ ] Free tier features show strikethrough for badge/leads/priority
- [ ] Short 5-field interest form is the primary CTA above the full form
- [ ] Short form submits to Supabase and web3forms with `notes = "Short form submission — follow up required"`
- [ ] Full detail form remains intact below with a clear heading separating it
- [ ] FAQ section added between pricing and forms
- [ ] Query params pre-fill both forms
- [ ] "Trusted by recyclers in 12 states" removed
- [ ] Page order matches the spec above
