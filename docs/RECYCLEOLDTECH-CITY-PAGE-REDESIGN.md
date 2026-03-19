# RecycleOldTech.com — City Page Redesign
## Cursor Implementation Prompt

---

## Context

The city pages (e.g. `/states/texas/carrollton`, `/states/wisconsin/milwaukee`) are the primary landing pages for organic search traffic and the main conversion surface for the Verified Partner program. The current layout has several issues that hurt both consumer experience and recycler conversion:

1. Too many CTAs and alert banners appear above the listings, creating noise before the visitor sees what they came for
2. The "About" section is long and sits above the listings, pushing the actual recycler list far down the page
3. The "Is this information incorrect?" banner is styled as a prominent orange alert, signaling broken data as the first thing visitors read
4. The Amazon trade-in block interrupts the listing flow
5. The page structure doesn't prioritize the listings — which is the entire reason people visit

The target file is the city page template. This is likely `src/pages/states/[state]/[city].astro` or equivalent. Apply changes to the template so all city pages benefit.

---

## Part 1: Remove CTAs From Above the Map

Currently there are multiple elements sitting between the hero and the map/listings:
- The orange "Is this information incorrect? Report It" banner
- The "Information Verified" date line
- The "Call ahead to confirm" warning
- The Amazon trade-in block

**Remove all of these from above the map.** They should be relocated as described below. The only thing between the hero and the listings/map should be the section heading ("Recycling Centers in [City]") and the sort controls.

---

## Part 2: Relocate the "Is This Information Incorrect?" Banner

The current amber/orange alert banner is the most damaging element on the page. It reads as a warning that the data is unreliable — exactly the wrong first impression.

**Changes:**
- Remove the banner entirely from its current position above the listings
- Replace it with a single subtle gray text line at the very bottom of the listings section, below all the cards: "See an error? [Report it →]" — small font, gray color, no background, no border
- The "Information Verified" date and "Call ahead to confirm" lines should also move here or be removed entirely. If kept, they should be in the same subtle gray treatment, not a colored banner.

---

## Part 3: Restructure the Page — New Content Order

Reorder the page sections so listings appear immediately after the hero. The new order should be:

1. **Hero** — city photo background, headline, verified date (subtle, small text), center count
2. **Listings Section** — map + recycler cards side by side (current layout is good, keep it)
   - Sort controls (Sort by Rating, Sort by Trust) stay here
   - "Is this your business? Claim this listing" links on each card stay here
   - At the very bottom of the listings section: subtle "See an error? Report it →" text link
3. **"Still not sure where to go?"** — the "Get Free Help" CTA button that scrolls to the recycling request form. This is fine here as a transition between listings and supporting content.
4. **Amazon Trade-In Block** — "Get Cash for Your Old Electronics" section. Move it here, after listings, before the about section. Consumers who didn't find what they needed in the listings may consider trade-in instead.
5. **About Electronics Recycling in [City]** — the long descriptive section. This is valuable for SEO but not for the primary user goal. It belongs after listings, not before.
6. **Recent Recycling News** — keep current position
7. **Environmental Impact Stats** — keep current position
8. **State E-Waste Regulations** — keep current position
9. **FAQ** — keep current position
10. **Why Recycling Matters** — keep current position
11. **Local Best Practices** — keep current position
12. **Resident's Guide** — keep current position
13. **Learn More (blog links)** — keep current position
14. **Before You Go** — keep current position
15. **Recycling Help Form** — keep at bottom as primary conversion CTA for consumers

---

## Part 4: Hero Cleanup

The hero currently shows multiple lines of helper text and warning badges immediately below the headline. Clean this up:

**Remove from the hero:**
- The amber "Is this information incorrect?" badge/link
- The "Call ahead to confirm they accept your specific items" line
- The "Facility details can change - always verify before visiting" line

**Keep in the hero:**
- City photo background
- Headline: "Electronics Recycling in [City]"
- Subtitle: "[N] certified recycling centers serving the [City] area"
- The verified date can stay but should be styled as small, subtle gray text — not a badge

The hero should feel clean and confident, not cautious and full of caveats.

---

## Part 5: Listing Cards — Minor Fixes

**Fix the accepted items tag capitalization.** Currently tags render as lowercase: "computers tablets phones". They should be title case or at minimum sentence case: "Computers" "Tablets" "Phones". This is a display formatting fix — capitalize the first letter of each tag.

**"Claim this listing" link styling.** The current plain text link at the bottom of each card needs a more prominent treatment. Change it to a small outlined button:
- Style: small, outlined, green border, green text, rounded
- Text: "Is this your business? Claim this listing →"
- On hover: light green background fill
- Position: bottom of card, below the action buttons row (Call Now / Visit Website / Get Directions)

This is the primary conversion element for the Verified Partner program. It needs to be noticeable but not aggressive.

---

## Part 6: Thin Pages (Fewer Than 3 Centers)

For city pages with fewer than 3 recycling centers, surface the recycling help form higher on the page — immediately after the listings section, before the about text. Add a heading above it:

"Only [N] center(s) found near [City]. Need more options?"

This acknowledges the thin coverage honestly and immediately offers an alternative rather than making the visitor scroll to the bottom of a long page to find the help form.

---

## Part 7: Sort Controls Cleanup

The current sort controls show "Sort by Rating" and "Sort by Trust" as separate buttons. This is fine but "Sort by Trust" is not a term consumers understand intuitively. Rename it to **"Sort by Verified"** so it's clear that clicking it surfaces verified partners first. This also subtly communicates to recyclers reviewing their listing that there's a benefit to being verified.

---

## Technical Notes

- This is an Astro SSG page. Changes apply to the city page template, not individual city pages.
- Tailwind CSS for styling — match existing utility classes
- The `VerifiedBadge.astro` component already exists for verified partner display
- The `parseJsonArray()` helper already exists for JSONB field parsing
- The recycling help form at the bottom already works — do not change its submission logic
- The map component rendering is separate — do not touch map logic
- The `content_enhanced` flag on recycling_centers controls verified partner display — do not change this logic
- Do not change any Supabase queries or data fetching logic — layout and display only

---

## Definition of Done

- [ ] No CTAs, banners, or warning text appear between the hero and the listings/map
- [ ] "Is this information incorrect?" is a subtle gray text link at the bottom of the listings section only
- [ ] Listings appear immediately after the hero
- [ ] About section appears after listings, not before
- [ ] Amazon trade-in block appears after listings, before about section
- [ ] Hero is clean — no warning badges or caveat lines
- [ ] Accepted items tags are capitalized
- [ ] "Claim this listing" has outlined green button styling
- [ ] "Sort by Trust" renamed to "Sort by Verified"
- [ ] Thin pages (fewer than 3 centers) surface the help form immediately after listings
- [ ] All existing functionality (map, sorting, form submission, verified badge display) remains intact
