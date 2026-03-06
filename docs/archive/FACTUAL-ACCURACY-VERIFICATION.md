# Factual Accuracy Verification Strategy
## AI-Powered Verification of City Description Accuracy

**Created:** November 3, 2025  
**Purpose:** Ensure generated city descriptions contain accurate information about recycling centers, cities, and states

---

## 🎯 Problem Statement

AI-generated city descriptions may contain:
- ❌ Incorrect recycling center counts
- ❌ Wrong population numbers
- ❌ Inaccurate state regulations claims
- ❌ Made-up statistics or facts
- ❌ Logical inconsistencies

**We need:** A secondary verification step using AI to check facts against our actual database.

---

## 🏗️ Proposed Solution: AI Fact-Checker

Use a **second AI model** to verify claims in the generated descriptions against actual data from our database.

### How It Works:

```
┌─────────────────────────────────────────────────────┐
│  1. Load Generated Description                      │
│     "Springfield has 15 recycling centers..."       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  2. Extract Factual Claims                          │
│     - "15 recycling centers"                        │
│     - "Population of 200,000"                       │
│     - "State requires e-waste recycling"            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  3. Query Database for Actual Data                  │
│     - Actual center count from recycling_centers    │
│     - Actual population from cities table           │
│     - Actual regulations from local_regulations     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  4. AI Compares Claims vs Reality                   │
│     Prompt: "Does this description accurately       │
│     reflect these facts? [database data]"           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  5. Report Discrepancies                            │
│     ✅ Center count: Correct (15)                   │
│     ❌ Population: Wrong (says 200k, actual 150k)   │
│     ⚠️  Regulations: Vague/unverifiable             │
└─────────────────────────────────────────────────────┘
```

---

## 🤖 Two-Stage Verification Process

### Stage 1: Automated Checks (Current Script)
**Purpose:** Catch obvious quality issues  
**Speed:** Fast (~1 second for all cities)  
**Cost:** Free  

Checks:
- Word count
- Paragraph structure
- City/state name presence
- Template phrases
- Profanity
- Duplicates

### Stage 2: AI Fact-Checking (New Script)
**Purpose:** Verify factual accuracy  
**Speed:** Slower (~30 seconds per city with AI calls)  
**Cost:** ~$0.0005 per city = ~$2 for all 4,000 cities  

Checks:
- Recycling center count accuracy
- Population numbers (if mentioned)
- State regulation claims
- Geographic details
- Logical consistency

---

## 📋 Verification Script Design

### Input Data for Each City:
```json
{
  "description": "Generated text...",
  "cityName": "Springfield",
  "stateName": "Illinois",
  "actualData": {
    "recyclingCenterCount": 15,
    "population": 150000,
    "stateRegulations": {
      "landfill_restrictions": "Illinois prohibits...",
      "has_restrictions": true
    }
  }
}
```

### AI Verification Prompt:
```
You are a fact-checker reviewing a city description for accuracy.

Description to verify:
"{description}"

Actual facts from our database:
- City: {cityName}, {stateName}
- Recycling centers: {actualCenterCount}
- Population: {actualPopulation}
- State regulations: {actualRegulations}

Review the description and identify:
1. ACCURATE claims (match database)
2. INACCURATE claims (contradict database)
3. UNVERIFIABLE claims (can't confirm/deny)
4. VAGUE claims (too general to verify)

Respond in JSON format:
{
  "overallAccuracy": "high|medium|low",
  "accurateClaims": ["claim1", "claim2"],
  "inaccurateClaims": [
    {"claim": "...", "actual": "...", "severity": "high|low"}
  ],
  "unverifiableClaims": ["claim1", "claim2"],
  "vagueClaims": ["claim1", "claim2"],
  "recommendation": "approve|review|regenerate"
}
```

---

## 🔍 What We Can Verify

### ✅ High Confidence (Direct Database Lookup)
1. **Recycling Center Count**
   - Source: `COUNT(*) FROM recycling_centers WHERE city = ? AND state = ?`
   - Example: "15 recycling centers" vs actual 15

2. **City/State Names**
   - Source: `cities` table
   - Ensure proper spelling and capitalization

3. **State Regulations (if in database)**
   - Source: `local_regulations` table
   - Check if claims match our regulation data

### ⚠️ Medium Confidence (Estimated/Inferred)
4. **Population Numbers**
   - Source: `cities.population` (if populated)
   - AI can flag if mentioned population differs by >20%

5. **Center Types**
   - Source: `recycling_centers.description`
   - Check if items accepted match what we have

### ❓ Low Confidence (Subjective/Unverifiable)
6. **Environmental Impact Claims**
   - "Reduces CO2 emissions" - generally true but not specific
   - Flag if overly specific claims are made

7. **Economic Benefits**
   - "Creates jobs" - generally true but hard to quantify
   - Flag if specific numbers are claimed

---

## 📊 Verification Levels

### Level 1: Critical Facts Only (Recommended)
**What:** Verify only hard numbers  
**Time:** ~5 minutes for 4,000 cities  
**Cost:** ~$0.50  

Checks:
- Recycling center count
- City/state spelling

### Level 2: Comprehensive (Thorough)
**What:** Verify all factual claims  
**Time:** ~30 minutes for 4,000 cities  
**Cost:** ~$2.00  

Checks:
- Center count
- Population (if mentioned)
- Regulations claims
- Logical consistency
- Vague/unverifiable statements

### Level 3: Full AI Review (Overkill)
**What:** AI reads and critiques everything  
**Time:** ~2 hours for 4,000 cities  
**Cost:** ~$6.00  

Not recommended - diminishing returns.

---

## 🛠️ Implementation Approach

### Option A: Batch Processing (Recommended)
**Process all cities at once**

Pros:
- ✅ Complete verification in one run
- ✅ Easier to track progress
- ✅ Can run overnight

Cons:
- ❌ Higher upfront cost (~$2)
- ❌ Takes 30-60 minutes

### Option B: On-Demand Verification
**Verify only cities with issues from Stage 1**

Pros:
- ✅ Lower cost (only verify flagged cities)
- ✅ Faster turnaround

Cons:
- ❌ May miss issues in "clean" descriptions
- ❌ More manual intervention

### Option C: Sampling (Quick Validation)
**Verify random 10% sample**

Pros:
- ✅ Very cheap (~$0.20)
- ✅ Quick confidence check
- ✅ Good for quality spot-check

Cons:
- ❌ Won't catch all errors
- ❌ Some inaccuracies may slip through

---

## 💡 Recommended Workflow

```
Step 1: Run cleanup-duplicate-cities.js
        ↓ (Remove duplicates, fix cityIds)

Step 2: Run verify-city-descriptions.js (Stage 1)
        ↓ (Quality checks, catch obvious issues)

Step 3: Review Stage 1 results
        ↓ (If >95% pass, continue)

Step 4: Run factual-accuracy-verification.js (Stage 2)
        ↓ (AI fact-checking against database)

Step 5: Review accuracy report
        ↓ (Flag high-severity inaccuracies)

Step 6: Regenerate flagged cities (if needed)
        ↓ (Fix specific issues)

Step 7: Import to database
        ↓ (Production ready!)
```

---

## 🚀 Script Features

### Core Features:
- [x] Query actual data from database for each city
- [x] Use AI to identify factual claims in description
- [x] Compare claims against database facts
- [x] Generate accuracy report
- [x] Flag high-severity inaccuracies
- [x] Provide regeneration recommendations

### Advanced Features:
- [x] Batch processing with rate limiting
- [x] Resume capability (checkpointing)
- [x] Accuracy scoring (0-100%)
- [x] Categorize issues by severity
- [x] Export flagged cities for regeneration
- [x] Cost tracking and estimation
- [x] Summary statistics
- [x] Sample output for manual review

---

## 📈 Expected Accuracy Issues

Based on how we generated the content:

**Low Risk (<5% of cities):**
- ✅ Center count - should be accurate (pulled from context)
- ✅ City/state names - should be correct (in prompt)

**Medium Risk (10-20% of cities):**
- ⚠️ Population numbers - AI may invent if not provided
- ⚠️ Specific regulation details - AI may generalize

**High Risk (>30% of cities):**
- ❌ Environmental statistics - AI likely making estimates
- ❌ Economic impact claims - AI inventing benefits
- ❌ Specific program details - AI filling in unknowns

---

## 🎯 Success Criteria

After Stage 2 verification:

**Excellent (>95% accurate):**
- All center counts correct
- No invented statistics
- Regulations match database (when mentioned)
- Ready for production

**Good (90-95% accurate):**
- Minor inaccuracies (rounding, estimates)
- Vague claims but not false
- May proceed with flagged review

**Poor (<90% accurate):**
- Major factual errors
- Invented data
- Requires regeneration

---

## 💰 Cost-Benefit Analysis

### Cost to Verify All 4,000 Cities:
- **Level 1 (Critical):** ~$0.50
- **Level 2 (Comprehensive):** ~$2.00
- **Level 3 (Full Review):** ~$6.00

### Cost of NOT Verifying:
- ❌ Google AdSense rejection (lost revenue)
- ❌ User trust issues (incorrect info)
- ❌ Legal liability (false claims)
- ❌ Manual corrections later (time-consuming)

**Recommendation:** Spend $2 on Level 2 verification - it's worth it!

---

## 📋 Next Steps

1. **Clean up duplicates** (run cleanup script first)
2. **Review this strategy** (decide on verification level)
3. **Implement verification script** (if approved)
4. **Run verification** (batch process)
5. **Review and fix flagged cities**
6. **Import clean data to database**

---

## ❓ Open Questions

1. **Verification Level:** Level 1, 2, or 3?
   - **Recommendation:** Level 2 (Comprehensive) - $2 for peace of mind

2. **Accuracy Threshold:** What % accuracy is acceptable?
   - **Recommendation:** >95% for critical facts, >90% overall

3. **Regeneration Strategy:** Auto-regenerate or manual review?
   - **Recommendation:** Manual review for high-severity, auto for low

4. **Sampling vs Full:** Verify all or sample?
   - **Recommendation:** Full verification (it's only $2)

---

**Decision needed:** Should we implement Stage 2 (AI fact-checking)?  
**Cost:** ~$2.00  
**Time:** ~30-60 minutes  
**Value:** Confidence in factual accuracy before importing to database

