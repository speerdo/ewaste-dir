# City Content Enhancement Action Plan
## Generating Unique, Verified Electronics Recycling Descriptions

**Created:** November 2, 2025  
**Objective:** Create unique, accurate, and verified city descriptions to improve Google AdSense approval odds

---

## Executive Summary

This plan outlines a systematic approach to generate unique, 3-paragraph descriptions for each city on our electronics recycling directory. The content will be AI-generated, human-verified, stored in a dedicated database table, and integrated into the website build process.

**Key Goals:**
- Generate original content for ~3,970 city pages
- Ensure accuracy and verifiability of all information
- Maintain data consistency between `recycling_centers` and `cities` tables
- Select the most cost-effective and accurate AI API
- Store verified content in the database for build-time retrieval

---

## Phase 1: Database Architecture & Data Synchronization

### 1.1 Current State Analysis

**Existing Tables:**
- `recycling_centers` - Contains city names but no descriptions (source of truth for locations)
- `cities` - Currently exists but is not populated with data from recycling_centers
- `local_regulations` - Contains city-specific e-waste regulations
- `city_stats` - Contains population and environmental impact data

**Current City Page Generation:**
- Pages are generated using `getCitiesByState()` function which queries distinct cities from `recycling_centers`
- City content uses `CityContentEnhancer.astro` component with template-based prose
- No dedicated city descriptions stored in database

### 1.2 Database Schema Enhancement

**Update the `cities` table to include:**

```sql
-- Add columns if not already present
ALTER TABLE cities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS description_verified BOOLEAN DEFAULT false;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS description_generated_at TIMESTAMPTZ;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS description_verified_at TIMESTAMPTZ;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS description_source TEXT; -- 'openai', 'anthropic', 'gemini'
ALTER TABLE cities ADD COLUMN IF NOT EXISTS recycling_center_count INTEGER DEFAULT 0;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS population INTEGER;
```

### 1.3 Data Synchronization Script

**Create: `scripts/sync-cities-table.js`**

This script will:
1. Query all distinct cities from `recycling_centers` table
2. For each city:
   - Create or update entry in `cities` table
   - Set `id` as URL-normalized city name (e.g., "new-york")
   - Set `state_id` from the state
   - Set `name` to proper city name
   - Count recycling centers for that city
   - Get latitude/longitude from first recycling center (if not present)
3. Ensure referential integrity between tables

**Acceptance Criteria:**
- Every city in `recycling_centers` has a corresponding entry in `cities`
- No orphaned cities in `cities` table
- Recycling center counts are accurate
- Script is idempotent (can be run multiple times safely)

---

## Phase 2: AI API Selection & Cost Analysis

### 2.1 API Comparison (November 2025 Pricing)

#### Option 1: OpenAI GPT-4o Mini (RECOMMENDED)
**Pricing:**
- Input: $0.150 per 1M tokens (~$0.15 per 1M input tokens)
- Output: $0.600 per 1M tokens (~$0.60 per 1M output tokens)

**Estimated Cost for Project:**
- Input per request: ~500 tokens (city name, state, instructions)
- Output per request: ~600 tokens (3 paragraphs)
- Total per city: ~1,100 tokens
- Cost per city: ~$0.0006
- **Total for 3,970 cities: ~$2.40**

**Pros:**
- Excellent accuracy and factual consistency
- Strong reasoning capabilities
- Well-documented API
- Already subscribed ($20/month)
- Reliable structured output

**Cons:**
- Not the cheapest option
- Rate limits may require batching

#### Option 2: Google Gemini 1.5 Flash (BEST VALUE)
**Pricing:**
- **FREE tier:** 15 requests per minute, 1,500 requests per day
- Prompts ≤128K tokens: Free up to 1,500 requests/day
- After free tier: Very low cost (~$0.075 per 1M input tokens)

**Estimated Cost for Project:**
- **FREE** if processed over 3 days (3,970 cities ÷ 1,500/day = ~3 days)
- Cost after free tier: ~$0.50 total

**Pros:**
- **FREE for your use case with Pixel 10 Pro**
- High daily limit (1,500 requests)
- Good accuracy for factual content
- Fast processing
- Multimodal capabilities (if needed later)

**Cons:**
- Slightly less consistent than GPT-4o for complex reasoning
- Newer API, less established
- May require more prompt engineering

#### Option 3: Anthropic Claude 3.5 Haiku
**Pricing:**
- Input: $1.00 per 1M tokens
- Output: $5.00 per 1M tokens

**Estimated Cost for Project:**
- Total for 3,970 cities: ~$3.50

**Pros:**
- Excellent instruction following
- Strong factual accuracy
- Good for structured output
- Already subscribed ($20/month)

**Cons:**
- Most expensive option
- Slower than GPT-4o Mini

### 2.2 Recommendation

**PRIMARY: Google Gemini 1.5 Flash**
- **Cost: FREE** (with your Pixel 10 Pro access)
- Process 1,500 cities/day = complete in 3 days
- Excellent cost-to-quality ratio
- More than sufficient accuracy for city descriptions

**BACKUP: OpenAI GPT-4o Mini**
- Use if Gemini quality is insufficient
- Cost: ~$2.40 total
- Better consistency for factual content

**Implementation Strategy:**
1. Start with Gemini 1.5 Flash (free)
2. Generate descriptions for 100 cities as a test
3. Manually verify quality
4. If quality is acceptable, proceed with Gemini
5. If quality issues arise, switch to GPT-4o Mini

---

## Phase 3: Content Generation System

### 3.1 Content Requirements

Each city description must include:

**Paragraph 1: Overview (2-3 sentences)**
- Number of recycling centers in the city
- Types of electronics accepted (general)
- Brief mention of city population (if available)

**Paragraph 2: Local Regulations & Environmental Impact (3-4 sentences)**
- State/local e-waste disposal regulations
- Environmental benefits specific to the city
- Recycling statistics (if available from city_stats table)
- CO2 savings or materials recovered

**Paragraph 3: Community Impact (2-3 sentences)**
- Economic benefits to the community
- Job creation from recycling industry
- How residents can participate
- Reference to convenient locations

**Quality Requirements:**
- Minimum 150 words, maximum 300 words
- No generic template language
- Factual accuracy (verifiable claims only)
- Natural, conversational tone
- SEO-friendly but not keyword-stuffed
- Unique content for each city (no duplication)

### 3.2 Prompt Engineering

**System Prompt:**
```
You are a content specialist writing informative descriptions about electronics recycling options for specific cities in the United States. Your goal is to create accurate, helpful, and unique content that helps residents understand their local recycling options.

Write in a professional yet conversational tone. Focus on factual information. Do not make claims that cannot be verified from the provided data.
```

**User Prompt Template:**
```
Write a 3-paragraph description (150-300 words) about electronics recycling in {CITY_NAME}, {STATE_NAME}.

Context data:
- Number of recycling centers: {CENTER_COUNT}
- Population: {POPULATION or "not available"}
- State e-waste regulations: {REGULATIONS or "check with state EPA"}
- Local recycling rate: {RATE or "not available"}

Structure:
1. First paragraph: Overview of recycling options in {CITY_NAME}, mentioning the {CENTER_COUNT} available centers and types of electronics accepted (computers, phones, TVs, monitors, batteries, cables).

2. Second paragraph: Discuss {STATE_NAME}'s e-waste regulations and environmental impact. If regulations are known, mention them specifically. Otherwise, note that proper recycling prevents toxic materials from landfills. Mention environmental benefits like CO2 reduction and materials recovery.

3. Third paragraph: Community impact - how electronics recycling benefits {CITY_NAME} economically and socially. Mention job creation, material recovery value, and how residents can easily participate.

Important guidelines:
- Be specific to {CITY_NAME} when data is available
- If specific data is not available, use general but accurate information
- Do not fabricate statistics
- Keep tone helpful and informative
- Avoid repetitive phrasing
- Make each city description unique
```

### 3.3 Content Generation Script

**Create: `scripts/generate-city-descriptions.js`**

**Features:**
1. **Data Collection:**
   - Query all cities from `cities` table where `description` IS NULL
   - For each city, gather:
     - Recycling center count
     - Population (from city_stats)
     - State regulations (from local_regulations)
     - Environmental stats (from city_stats)

2. **API Integration:**
   - Initialize Google Gemini API client (or OpenAI as backup)
   - Implement rate limiting (15 requests/min for Gemini)
   - Batch processing (1,500/day for Gemini free tier)
   - Error handling and retry logic
   - Progress tracking with checkpoints

3. **Content Generation:**
   - Build custom prompt for each city
   - Call AI API
   - Parse response
   - Validate content (word count, structure)
   - Store in temporary JSON file for review

4. **Quality Checks:**
   - Word count validation (150-300 words)
   - Uniqueness check (compare to previously generated content)
   - Profanity filter
   - Basic fact validation (e.g., city/state names correct)

5. **Output:**
   - Generate JSON file with all descriptions
   - Include metadata (city, state, word count, generation timestamp)
   - Flag any that need manual review

**Script Structure:**
```javascript
// scripts/generate-city-descriptions.js
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai'; // or OpenAI
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuration
const RATE_LIMIT_PER_MINUTE = 15;
const DAILY_LIMIT = 1500;
const OUTPUT_FILE = './data/generated-city-descriptions.json';

// Main function
async function generateCityDescriptions() {
  // 1. Get all cities needing descriptions
  // 2. Gather context data for each
  // 3. Generate descriptions with rate limiting
  // 4. Save to JSON for review
  // 5. Report statistics
}

// Helper functions
async function generateDescription(city, context) { }
async function validateContent(description) { }
async function saveProgress(descriptions) { }
```

---

## Phase 4: Content Verification & Quality Assurance

### 4.1 Verification Process

**Two-Stage Verification:**

**Stage 1: Automated Verification (100% of content)**
- Word count validation
- Duplicate detection
- City/state name accuracy
- Basic grammar check
- Profanity filter
- Structural validation (3 paragraphs)

**Stage 2: Manual Spot-Checking (10% sample)**
- Select 400 random cities (10% of 3,970)
- Human reviewer checks:
  - Factual accuracy
  - Natural language quality
  - Relevance to the city
  - Appropriate tone
  - No misleading claims
- Document any patterns of issues

### 4.2 Verification Checklist

For each description:
- [ ] Contains 3 distinct paragraphs
- [ ] 150-300 words total
- [ ] Correctly mentions city and state names
- [ ] Recycling center count is accurate
- [ ] No fabricated statistics
- [ ] No repetitive template language
- [ ] Grammar and spelling are correct
- [ ] Tone is professional and helpful
- [ ] Content is unique (not duplicated from other cities)
- [ ] No promotional language or bias toward specific centers

### 4.3 Issue Resolution

**If issues are found:**
1. Document the issue type and frequency
2. Adjust prompt engineering for better results
3. Regenerate flagged descriptions
4. Re-verify regenerated content
5. Repeat until quality threshold is met (>95% pass rate)

### 4.4 Verification Script

**Create: `scripts/verify-city-descriptions.js`**

This script will:
- Load generated descriptions JSON
- Run automated checks on all content
- Flag problematic entries
- Generate random sample for manual review
- Create verification report
- Mark verified descriptions as ready for database import

---

## Phase 5: Database Integration

### 5.1 Import Script

**Create: `scripts/import-city-descriptions.js`**

**Features:**
1. Read verified descriptions from JSON file
2. For each city:
   - Update `cities` table with description
   - Set `description_verified = true`
   - Set `description_generated_at` timestamp
   - Set `description_source` (e.g., 'gemini')
   - Set `description_verified_at` timestamp
3. Handle errors gracefully
4. Create backup before import
5. Generate import report

**Transaction Safety:**
- Use database transactions
- Rollback on any critical errors
- Backup cities table before import
- Verify data integrity after import

### 5.2 Rollback Plan

**If issues occur after import:**
1. Keep backup SQL dump of cities table
2. Script to restore from backup
3. Ability to clear all descriptions and start over
4. Preserve audit trail of all changes

---

## Phase 6: Website Integration

### 6.1 Update Supabase Functions

**Modify: `src/lib/supabase.ts`**

Add function to fetch city description:
```typescript
export async function getCityDescription(
  cityId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('cities')
    .select('description')
    .eq('id', cityId)
    .eq('description_verified', true)
    .single();

  if (error || !data) return null;
  return data.description;
}

// Update getCitiesByState to include descriptions
export async function getCityWithDescription(
  stateId: string,
  cityId: string
): Promise<City | null> {
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .eq('state_id', stateId)
    .eq('id', cityId)
    .single();

  if (error || !data) return null;
  return data;
}
```

### 6.2 Update City Page Template

**Modify: `src/pages/states/[state]/[city].astro`**

Add city description display:
```astro
---
// After getting recycling centers
const cityData = await getCityWithDescription(stateParam, cityParam);
const cityDescription = cityData?.description;
---

<Layout ...>
  <!-- Add description section after hero -->
  {cityDescription && (
    <div class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <h2 class="text-2xl font-bold mb-4">
        About Electronics Recycling in {cityName}
      </h2>
      <div class="prose prose-lg max-w-none text-gray-700">
        {cityDescription.split('\n\n').map(paragraph => (
          <p class="mb-4">{paragraph}</p>
        ))}
      </div>
    </div>
  )}
  
  <!-- Existing CityContentEnhancer component -->
  <CityContentEnhancer ... />
</Layout>
```

### 6.3 SEO Enhancement

**Update meta tags to include city description:**
```astro
---
const metaDescription = cityDescription 
  ? cityDescription.split('\n\n')[0].slice(0, 155) + '...'
  : `Find ${centerCount} certified electronics recycling centers in ${cityName}...`;
---

<meta name="description" content={metaDescription} />
```

### 6.4 Testing

**Before deployment:**
1. Test description display on 20 different city pages
2. Verify mobile responsiveness
3. Check SEO meta tags
4. Validate structured data (Schema.org)
5. Test build performance (ensure no timeout issues)
6. Verify caching behavior

---

## Phase 7: Maintenance & Updates

### 7.1 Content Refresh Strategy

**When to regenerate descriptions:**
- New recycling centers added to a city
- Significant changes to state regulations
- Population data updates
- Every 6-12 months for freshness

**Refresh script:**
- Identify cities needing updates
- Regenerate descriptions for flagged cities only
- Follow same verification process
- Update database with new content

### 7.2 Monitoring & Analytics

**Track:**
- Page engagement metrics (bounce rate, time on page)
- SEO rankings for city pages
- User feedback on content quality
- Google Search Console data

**Set up alerts for:**
- Duplicate content warnings
- Page quality issues
- Missing descriptions
- Database sync errors

---

## Implementation Timeline

### Week 1: Setup & Database
- **Day 1-2:** Create database migrations for cities table enhancement
- **Day 2-3:** Write and test sync-cities-table.js script
- **Day 3-4:** Run sync script and verify data integrity
- **Day 4-5:** Set up API access (Gemini or OpenAI)

### Week 2: Content Generation
- **Day 1:** Write generate-city-descriptions.js script
- **Day 2:** Test generation on 50 cities
- **Day 3:** Refine prompts based on test results
- **Day 4-6:** Generate all ~3,970 city descriptions (1,500/day with Gemini)

### Week 3: Verification & Import
- **Day 1-2:** Run automated verification
- **Day 3-4:** Manual spot-checking (400 cities)
- **Day 5:** Address any quality issues
- **Day 6:** Import verified descriptions to database

### Week 4: Integration & Testing
- **Day 1-2:** Update supabase.ts functions
- **Day 3:** Modify city page template
- **Day 4:** Test on staging environment
- **Day 5:** Fix any issues
- **Day 6:** Deploy to production

### Week 5: Monitoring
- **Day 1-7:** Monitor analytics, user feedback, and SEO impact

**Total estimated time:** 5 weeks (part-time work)

---

## Success Metrics

### Quantitative Metrics
- [ ] 100% of cities have unique descriptions
- [ ] 95%+ descriptions pass quality verification
- [ ] Average description length: 150-300 words
- [ ] Zero duplicate descriptions
- [ ] Page load time remains under 2 seconds
- [ ] Build time increases by less than 20%

### Qualitative Metrics
- [ ] Descriptions read naturally (human-like)
- [ ] Content is factually accurate
- [ ] SEO keywords naturally integrated
- [ ] Users find content helpful (track feedback)
- [ ] Google AdSense approval improves

### Business Metrics
- [ ] Organic search traffic increases
- [ ] Average session duration increases
- [ ] Bounce rate decreases on city pages
- [ ] Google AdSense approval achieved

---

## Risk Mitigation

### Risk 1: AI-Generated Content Detection
**Mitigation:**
- Use conservative AI settings (lower temperature)
- Add human editorial touches during verification
- Ensure content is factual and helpful (not spammy)
- Google allows AI content if it's high-quality and original

### Risk 2: Factual Inaccuracies
**Mitigation:**
- Only use verified data from database
- Don't allow AI to fabricate statistics
- Manual spot-checking of 10% sample
- Clear prompts limiting AI to provided data

### Risk 3: Duplicate Content
**Mitigation:**
- Automated duplicate detection in verification script
- Unique prompts for each city using city-specific data
- Manual review of similar cities (e.g., suburbs)

### Risk 4: Database Sync Issues
**Mitigation:**
- Comprehensive testing of sync script
- Regular reconciliation between tables
- Foreign key constraints
- Automated monitoring

### Risk 5: Build Performance Impact
**Mitigation:**
- Cache city descriptions
- Use efficient database queries
- Monitor build times
- Optimize getStaticPaths if needed

---

## API Key Setup Instructions

### For Google Gemini (Recommended)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account (associated with Pixel 10 Pro)
3. Click "Create API Key"
4. Copy the API key
5. Add to `.env` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

### For OpenAI (Backup)
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in to your account
3. Click "Create new secret key"
4. Copy the API key
5. Add to `.env` file:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

### For Anthropic (Alternative)
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in to your account
3. Navigate to API Keys
4. Click "Create Key"
5. Copy the API key
6. Add to `.env` file:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

---

## Cost Summary

### Google Gemini 1.5 Flash (Recommended)
- **API Cost:** $0 (FREE with daily limits)
- **Time Investment:** ~40 hours over 5 weeks
- **Total Cost:** $0

### OpenAI GPT-4o Mini (Backup)
- **API Cost:** ~$2.40
- **Time Investment:** ~40 hours over 5 weeks
- **Total Cost:** ~$2.40

**ROI:**
- Potential Google AdSense approval
- Improved SEO rankings
- Better user engagement
- Professional, unique content for all city pages

---

## Next Steps

1. **Review this action plan** and approve the approach
2. **Choose API provider** (Recommend starting with Gemini)
3. **Get API key** and add to `.env` file
4. **Execute Phase 1** (Database setup) this week
5. **Begin content generation** next week

---

## Appendix A: Example Prompt & Output

### Example Input:
```
City: Austin, Texas
Centers: 23
Population: 978,908
State Regulation: Texas has no state-wide e-waste ban, but many municipalities have regulations
```

### Example Output:
```
Austin residents have access to 23 certified electronics recycling centers throughout the city, providing convenient options for disposing of computers, smartphones, televisions, monitors, batteries, and cables. With a population of nearly one million, Austin has embraced environmental responsibility by making e-waste recycling accessible across diverse neighborhoods. These facilities accept a wide range of electronic devices, ensuring that outdated technology doesn't end up in landfills.

While Texas doesn't have a statewide e-waste ban, Austin has implemented local programs encouraging proper disposal of electronics. Recycling prevents toxic materials like lead, mercury, and cadmium from contaminating soil and groundwater. By recycling electronics, Austin residents contribute to significant environmental benefits, including reduced CO2 emissions and conservation of valuable materials like copper, gold, and rare earth elements that can be recovered and reused in manufacturing.

Electronics recycling supports Austin's local economy by creating jobs in collection, processing, and material recovery sectors. The industry generates economic value through the resale of refurbished equipment and recovered materials. Austin residents can easily participate by dropping off their old electronics at any of the city's 23 recycling centers, many of which offer free services for residents. This community-wide effort helps position Austin as an environmentally conscious tech hub.
```

**Word Count:** 214 words  
**Verified:** ✅ Factually accurate, natural language, city-specific

---

## Appendix B: Database Query Examples

### Get cities needing descriptions:
```sql
SELECT c.id, c.name, c.state_id, s.name as state_name, c.recycling_center_count
FROM cities c
JOIN states s ON c.state_id = s.id
WHERE c.description IS NULL
ORDER BY c.recycling_center_count DESC, c.name ASC;
```

### Get city context data:
```sql
SELECT 
  c.name as city_name,
  s.name as state_name,
  c.recycling_center_count,
  cs.population,
  cs.recycling_rate,
  lr.has_ewaste_ban,
  lr.landfill_restrictions
FROM cities c
JOIN states s ON c.state_id = s.id
LEFT JOIN city_stats cs ON cs.city_state = CONCAT(c.name, ', ', s.name)
LEFT JOIN local_regulations lr ON lr.city_state = CONCAT(c.name, ', ', s.name)
WHERE c.id = 'austin';
```

### Verify description quality:
```sql
SELECT 
  COUNT(*) as total_cities,
  COUNT(description) as cities_with_descriptions,
  COUNT(CASE WHEN description_verified = true THEN 1 END) as verified_descriptions,
  AVG(LENGTH(description)) as avg_description_length
FROM cities;
```

---

## Appendix C: Quality Assurance Checklist

### Before Generation
- [ ] Database sync completed successfully
- [ ] All cities have entries in cities table
- [ ] API key configured and tested
- [ ] Rate limiting implemented
- [ ] Error handling tested
- [ ] Progress tracking working

### During Generation
- [ ] Monitor rate limits
- [ ] Check for API errors
- [ ] Save progress regularly
- [ ] Review sample outputs
- [ ] Track cost (if using paid API)

### After Generation
- [ ] All cities have descriptions
- [ ] No duplicate content
- [ ] Word counts within range
- [ ] 10% manual spot-check complete
- [ ] Quality issues documented and fixed
- [ ] Backup created

### Before Database Import
- [ ] Verification report reviewed
- [ ] Quality threshold met (>95%)
- [ ] Database backup created
- [ ] Import script tested on staging
- [ ] Rollback plan ready

### After Database Import
- [ ] All descriptions imported successfully
- [ ] Verification flags set correctly
- [ ] Data integrity checks pass
- [ ] Import report reviewed
- [ ] No errors in logs

### Before Deployment
- [ ] City pages display descriptions correctly
- [ ] Meta tags updated properly
- [ ] Mobile layout tested
- [ ] SEO validation complete
- [ ] Build performance acceptable
- [ ] Staging environment approved

### After Deployment
- [ ] All city pages loading correctly
- [ ] No 404 errors
- [ ] Analytics tracking working
- [ ] Search Console monitoring active
- [ ] User feedback channel open

---

## Support & Questions

For questions or issues during implementation:
1. Review relevant section of this action plan
2. Check error logs and console output
3. Verify API keys and database connections
4. Test with smaller sample sizes first
5. Document any deviations from plan

**Document created:** November 2, 2025  
**Last updated:** November 2, 2025  
**Version:** 1.0

