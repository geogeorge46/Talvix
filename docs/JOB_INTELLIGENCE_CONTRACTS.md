# Talvix Stage 3A — Structured AI Job Intelligence Integration Contracts

This document defines the formal data structures and interface contracts by which downstream recruitment services consume Structured AI Job Intelligence.

---

## 1. Schema Contract & Versioning

All extracted intelligence documents adhere to `schemaVersion: 1` and are stored on the `Job.intelligence` document field:

```json
{
  "schemaVersion": 1,
  "promptVersion": 1,
  "status": "completed | stale | pending | failed | none",
  "extractedAt": "2026-10-09T18:00:00.000Z",
  "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "data": {
    "jobTitle": "Senior Full-Stack Engineer",
    "seniorityLevel": "senior",
    "employmentType": "full-time",
    "minimumExperience": 5,
    "maximumExperience": 8,
    "requiredSkills": [
      {
        "name": "React",
        "category": "frontend",
        "requirementType": "required",
        "importance": "critical",
        "evidence": "5+ years of hands-on React development experience",
        "source": "explicit"
      },
      {
        "name": "Node.js",
        "category": "backend",
        "requirementType": "required",
        "importance": "high",
        "evidence": "Strong proficiency in Node.js Express APIs",
        "source": "explicit"
      }
    ],
    "preferredSkills": [
      {
        "name": "Docker",
        "category": "devops",
        "requirementType": "preferred",
        "importance": "medium",
        "evidence": "Containerization experience with Docker is a plus",
        "source": "explicit"
      }
    ],
    "responsibilities": [
      { "text": "Architect scalable backend services and micro-frontend components", "source": "explicit" }
    ],
    "qualifications": [
      { "text": "Bachelor degree in Computer Science or equivalent practical experience", "source": "explicit" }
    ],
    "educationRequirements": ["B.S. in Computer Science"],
    "domainKnowledge": ["Distributed Systems", "SaaS Platforms"],
    "assessmentRecommendations": [
      {
        "category": "Coding",
        "domain": "frontend",
        "reason": "Critical skill requirement: React state management & component architecture",
        "source": "inferred"
      }
    ]
  },
  "error": ""
}
```

---

## 2. Downstream Consumption Contracts

### A. Resume-to-Job Skill Matching
Downstream matching engines consume `intelligence.data.requiredSkills` and `preferredSkills` using canonical skill names (`name`).

- **Matching Formula:**
  $$\text{SkillsScore} = \frac{\sum (W_{\text{importance}} \times \text{MatchedSkill})}{\sum W_{\text{importance}}} \times 100$$
  where $W_{\text{critical}} = 4$, $W_{\text{high}} = 3$, $W_{\text{medium}} = 2$, $W_{\text{low}} = 1$.
- **Explicit vs Inferred Weighting:** Explicit skills carry a $1.0\times$ multiplier; AI-inferred skills carry a $0.85\times$ multiplier.

### B. Candidate Skill-Gap Analysis
Identifies discrepancies between candidate resume skills and job requirements:
- **Critical Skill Gaps:** Any skill in `requiredSkills` where `importance === 'critical'` or `'high'` that is absent from the candidate's canonical skill list.
- **Nice-to-Have Bonus:** Matched skills in `preferredSkills` add to the candidate's overall fit score.

### C. Technical Assessment Blueprint Generation
Uses `intelligence.data.assessmentRecommendations` to construct automated candidate assessment suites:
- Maps `seniorityLevel` to difficulty level:
  - `intern` / `entry` $\rightarrow$ Easy / Foundational Syntax & Algorithms
  - `mid` $\rightarrow$ Medium / Production Application Development
  - `senior` / `lead` $\rightarrow$ Hard / Architecture, System Design & Performance
- Selects assessment question types based on `requiredSkills` categories:
  - `frontend` $\rightarrow$ React/Vue Work-Sample or Live Component Coding
  - `backend` $\rightarrow$ Node.js/Express API implementation & DB queries
  - `database` $\rightarrow$ Schema Design & Indexing scenarios

### D. Assessment Rubric Selection
Maps `seniorityLevel` to rubric criteria evaluation weights:
- `senior` / `lead`: 40% Architecture & Design Patterns, 30% Edge Case Handling, 20% Performance/Complexity, 10% Code Style.
- `entry` / `mid`: 50% Functional Correctness, 30% Code Style, 20% Testing.
