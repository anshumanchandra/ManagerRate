# 🗺️ ManagerRate — Complete Feature Roadmap (39 Features)

*Based on competitive analysis and product vision by Anshuman Chandra*

---

## Priority Matrix

### 🔴 Phase 1 — Core Differentiation (Build First)
These features make ManagerRate fundamentally different from every competitor.

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 3 | Manager Identity System (city, dept, business unit) | 🔥🔥🔥 | Medium |
| 4 | Manager Entity Matching (search+select, not free-text) | 🔥🔥🔥 | Medium |
| 6 | "Would you work for them again?" (5-level) | 🔥🔥🔥 | Low |
| 7 | Strengths/Weaknesses Picker (top 3-5) | 🔥🔥🔥 | Low |
| 10 | Tenure question ("How long did you work with them?") | 🔥🔥 | Low |
| 11 | Reviewer relationship type (direct report, skip-level, etc.) | 🔥🔥 | Low |
| 38 | Multi-step review form (3-5 min flow) | 🔥🔥🔥 | Medium |

### 🟡 Phase 2 — Trust & Verification
These features make the platform credible and defensible.

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 12 | Verification score (verified/likely/unverified) | 🔥🔥🔥 | High |
| 13 | Employment verification (work email, LinkedIn, domain) | 🔥🔥🔥 | High |
| 14 | Anonymous publicly + verified privately | 🔥🔥 | Medium |
| 15 | Anti-defamation system (content guidelines, PII blocking) | 🔥🔥🔥 | Medium |
| 18 | Minimum review threshold (no score < 3 reviews) | 🔥🔥 | Low |
| 19 | Bayesian/Wilson scoring (not simple average) | 🔥🔥 | Medium |
| 20 | Review bombing detection | 🔥🔥 | Medium |
| 21 | One review per manager per employment period | 🔥🔥 | Low |

### 🟢 Phase 3 — Intelligence & Analytics
These features create the data moat.

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 5 | 25-dimension rating system (5 groups of 5) | 🔥🔥 | Medium |
| 8 | Manager timeline (rating over time) | 🔥🔥🔥 | Medium |
| 9 | Review recency weighting + Recent Manager Score | 🔥🔥 | Medium |
| 22 | Review evolution (same person updates after 6-12 months) | 🔥🔥 | Medium |
| 23 | Team-level intelligence (Company→Dept→Team→Manager) | 🔥🔥 | High |
| 24 | Manager vs Company comparison | 🔥🔥 | Medium |
| 32 | AI-generated manager summary | 🔥🔥🔥 | Medium |
| 33 | Disagreement detection (conflicting reviews) | 🔥🔥 | Medium |
| 35 | Current vs Former employee split | 🔥🔥 | Low |

### 🔵 Phase 4 — Search & Discovery
These features drive organic growth and SEO.

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 25 | Manager search engine (homepage hero) | 🔥🔥🔥 | Medium |
| 26 | Company search + manager listing | 🔥🔥 | Medium |
| 27 | "Best managers at X" pages (SEO) | 🔥🔥🔥 | Medium |
| 34 | Location/team/dept/status filters | 🔥🔥 | Medium |
| 36 | Manager career history tracking | 🔥🔥 | Medium |

### 🟣 Phase 5 — Advanced Features
These features make the platform a career decision tool.

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 16 | Manager right to respond | 🔥🔥 | Medium |
| 17 | Company response + paid business plans | 🔥🔥🔥 | High |
| 28 | Manager compatibility matching | 🔥🔥🔥 | High |
| 29 | Interview experience → Manager connection | 🔥🔥 | High |
| 30 | Manager-specific interview intelligence | 🔥🔥 | Medium |
| 31 | "What should I ask this manager?" (AI) | 🔥🔥🔥 | Medium |
| 37 | Entity-based database architecture | 🔥🔥🔥 | High |
| 39 | Optimized review questions | 🔥🔥 | Low |

---

## Feature Details

### Feature 11: Reviewer Relationship Type
```
Your relationship with this manager:
○ Direct report
○ Skip-level report
○ Project manager
○ Cross-functional partner
○ Peer
○ Former direct report
```
→ Users can filter: "Direct reports only"

### Feature 12-14: Verification System
```
Review credibility badges:
🟢 Verified employment (work email confirmed)
🟡 Employment likely (LinkedIn connected)
⚪ Unverified

Display format:
"Anonymous Software Engineer
 Amazon · Bengaluru
 Worked with manager: 2 years
 Employment verified ✓"
```

### Feature 18: Minimum Review Threshold
```
1-2 reviews: "Insufficient reviews" (no score shown)
3-4 reviews: "Provisional score" (with disclaimer)
5-9 reviews: Score shown
10+ reviews: "High confidence" badge
```

### Feature 19: Bayesian Scoring
```
Instead of simple average:
4.6 ★ (1,842 reviews) — High confidence
4.8 ★ (5 reviews) — Low confidence

Formula: (v/(v+m)) * R + (m/(v+m)) * C
Where:
  R = item's average rating
  v = number of votes for the item
  m = minimum votes to be listed (e.g., 5)
  C = overall average rating across all managers
```

### Feature 20: Review Bombing Detection
```
Triggers:
- 10+ reviews for same manager within 24 hours
- 20+ 5-star reviews from same company in 2 days
- 5+ 1-star reviews from same IP range in 1 hour

Action: Hold suspicious reviews for moderation
Display: ⚠️ "Unusual review activity detected"
```

### Feature 22: Review Evolution
```
Employee's evolving experience:
After 6 months:  4.5 ★ "Great mentorship, learning a lot"
After 18 months: 3.5 ★ "Growth has stalled, feedback less frequent"
After 30 months: 2.5 ★ "Promotion path unclear, workload increased"

→ Tells a much richer story than a single snapshot
```

### Feature 28: Manager Compatibility
```
Ask employee preferences:
□ Hands-off  □ Highly involved
□ Career-focused  □ Technical
□ Supportive  □ Fast-paced
□ Structured  □ Flexible

Then show:
"Manager X — Your compatibility: 87%
 You prefer autonomy → Manager scores 4.7 on delegation
 You prefer structured feedback → Manager scores 4.5"
```

### Feature 32: AI Manager Summary
```
Based on 42 reviews:

Common positives:
✅ Technical mentorship
✅ Autonomy and ownership
✅ Clear expectations

Common concerns:
⚠️ High workload
⚠️ Limited promotion opportunities

Confidence: High
```

### Feature 37: Entity Database Architecture
```
Person
  ↓
Manager Profile
  ↓
Employment (company, dept, team, dates)
  ↓
Reviews
  ↓
  ├── manager_id
  ├── company_id
  ├── department_id
  ├── team_id
  ├── reviewer_role
  ├── employment_status (current/former)
  ├── employment_duration
  ├── relationship_type
  ├── review_date
  ├── rating_dimensions (25)
  ├── work_again_score
  ├── strengths[] (3-5 tags)
  ├── weaknesses[] (3-5 tags)
  ├── text_review
  ├── verification_status
  └── moderation_status
```

### Feature 38: Multi-Step Review Form
```
Step 1: Who was your manager? (search + select)
Step 2: How long did you work with them? (tenure picker)
Step 3: What was your relationship? (direct report, etc.)
Step 4: Rate 8-10 dimensions (stars)
Step 5: Would you work with them again? (5-level)
Step 6: Select strengths (3-5 tags)
Step 7: Select weaknesses (3-5 tags)
Step 8: What did they do well? (free text)
Step 9: What could they improve? (free text)
Step 10: Verify employment (optional, adds badge)

Target: 3-5 minutes maximum
```

---

## Guiding Principles

1. **Manager is the entity, not the company**
2. **Money cannot buy a better rating** — ever
3. **Anonymous publicly, verified privately**
4. **Protect managers from defamation, protect employees from retaliation**
5. **Never show misleading scores** (min threshold + Bayesian scoring)
6. **Recency matters** — weight recent reviews higher
7. **Context matters** — tenure, relationship, verification all factor in
8. **Detect and prevent manipulation** — bombing, self-reviews, coordinated attacks
9. **Give managers a voice** — right to respond, not right to delete
10. **Build a data moat** — structured data > free-text complaints

---

*This roadmap transforms ManagerRate from a review site into the definitive manager reputation database — the "IMDB of managers."*
