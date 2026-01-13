# Recycling Center Description Fix Strategy

## Problem Statement

All recycling centers in the database have descriptions that are either:
1. **Generic templates** - Auto-generated from patterns, not specific to the business
2. **Incorrect specialty tags** - Descriptions trigger wrong specialty tags (e.g., "Metal Recycling", "Computer Repair") when the business doesn't actually offer those services
3. **Missing specificity** - Descriptions don't accurately reflect what each business actually does

**Impact:**
- Users see incorrect information about what services are available
- Specialty tags are misleading
- Reduces trust and accuracy of the directory

## Current State

- **Total centers:** ~28,500
- **Centers with descriptions:** ~28,400
- **Centers with generic descriptions:** Estimated 60-80%
- **Centers with incorrect specialties:** Unknown, but likely significant

## Solution Approaches

### Approach 1: AI-Powered Description Regeneration (Recommended)

**Pros:**
- Can process all centers at scale
- Can use business name, website, and existing data to generate accurate descriptions
- Can be done incrementally

**Cons:**
- Requires API costs (OpenAI/Gemini)
- May need manual review for accuracy
- Takes time to process all centers

**Implementation:**
1. Use existing website scraper data
2. Use business name patterns
3. Use AI to generate specific, accurate descriptions
4. Include only services actually mentioned on website/name

### Approach 2: Manual Review Queue

**Pros:**
- Highest accuracy
- Can verify against actual business websites
- Can fix specialty tags at the same time

**Cons:**
- Very time-consuming (28,500 centers)
- Not scalable

**Implementation:**
1. Create priority queue based on:
   - Centers with generic descriptions
   - Centers with incorrect specialty tags
   - High-traffic areas first
2. Manual review tool to:
   - View current description
   - View detected specialties
   - Update description
   - Set excluded specialties
   - Mark as reviewed

### Approach 3: Hybrid Approach (Best)

**Phase 1: Automated Analysis** (1-2 days)
- Run analysis script to identify problematic centers
- Prioritize by severity and traffic

**Phase 2: AI Regeneration** (1-2 weeks)
- Use AI to regenerate descriptions for high-priority centers
- Focus on centers with generic descriptions
- Use website data when available

**Phase 3: Manual Review** (Ongoing)
- Review AI-generated descriptions for accuracy
- Fix specialty tags as needed
- Handle edge cases manually

## Implementation Plan

### Step 1: Analysis (Current)

Run `analyze-description-accuracy.js` to:
- Identify centers with generic descriptions
- Identify centers with incorrect specialties
- Create priority queue

### Step 2: AI Description Generation

Create `regenerate-descriptions.js` that:
1. Fetches centers needing new descriptions
2. Uses website scraper data if available
3. Uses AI (Gemini/OpenAI) to generate accurate descriptions
4. Validates descriptions don't trigger incorrect specialties
5. Updates database

### Step 3: Manual Review Tool

Create web interface or script to:
- Show center details
- Show current description and detected specialties
- Allow editing description
- Allow setting excluded specialties
- Track review status

### Step 4: Ongoing Maintenance

- Add description quality checks to scraper
- Flag new centers with generic descriptions
- Regular audits of specialty accuracy

## Priority Order

1. **High Priority:**
   - Centers with generic template descriptions
   - Centers with clearly incorrect specialties
   - Centers in high-traffic cities

2. **Medium Priority:**
   - Centers with vague descriptions
   - Centers with too many specialties detected

3. **Low Priority:**
   - Centers with acceptable descriptions
   - Centers already manually reviewed

## Success Metrics

- **Description Quality:**
  - % of centers with generic descriptions: Target < 10%
  - % of centers with accurate specialties: Target > 90%
  
- **User Experience:**
  - Reduced user complaints about incorrect information
  - Better search/filter accuracy

## Tools Created

1. ✅ `analyze-description-accuracy.js` - Identifies problematic descriptions
2. 🔄 `regenerate-descriptions.js` - AI-powered description regeneration (to be created)
3. 🔄 `manual-review-tool.js` - Tool for manual review and fixes (to be created)

## Next Steps

1. Run analysis script to get baseline metrics
2. Review high-priority centers
3. Create AI regeneration script
4. Start with high-priority centers
5. Iterate based on results
