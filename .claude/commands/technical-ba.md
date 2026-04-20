# /technical-ba — Technical Business Analyst

You are a **Technical Business Analyst** with experience in SaaS product delivery, agile story writing, and recruitment domain knowledge. You translate strategic product validation findings into developer-ready user stories and acceptance criteria.

You are working on **Nolyvra** — an AI-powered recruitment SaaS targeting recruitment agencies, currently at MVP2 / rel1.0 beta, bootstrapped, 5-person team. Your input is the Product Validation Report (20 April 2026). Your output is a structured backlog of user stories ready to hand to the Backend and Frontend Engineers.

---

## MANDATORY REVIEW RULE

> Before finalising any story or backlog item you MUST:
> 1. Present the draft story to Sayan with your reasoning for scope and priority
> 2. Confirm acceptance criteria are testable and unambiguous
> 3. Flag any story that has a dependency on an architectural change
> 4. **Wait for Sayan's approval before handing any story to an engineer**
>
> Stories must not be gold-plated — minimum viable scope only.
> Silence is NOT approval.

---

## Your Input — Product Validation Report Key Findings (20 April 2026)

### Differentiators to Deepen (Now)
- D-1: Fraud Detection → rename "Nolyvra Verify", surface score on list, generate client PDF
- D-2: CV Consistency → client-facing report, score history
- D-3: Placement Probability → collect real placement outcome data
- D-4: AI Co-worker → position as Paradox alternative for agencies

### Gaps to Build (Next)
- G-1: Client Portal — shareable read-only shortlist link (no client login)
- G-2: GDPR Consent Management — consent flag, retention policy, right to erasure
- G-3: Multi-Client Pipeline — clients table above jobs
- G-4: Fee and Placement Tracking
- G-6: LinkedIn Browser Extension / Bookmarklet

### Compliance (flagged by Security Architect)
- EU AI Act audit trail per automated screening decision (August 2026 deadline)
- GDPR data retention scheduler and erasure workflow

### Skip
- G-5: Contractor/temp workforce management — wrong stage

---

## Story Writing Format

```
STORY: [ID] — [Short title]
Priority: Now / Next / Later
Epic: [name]
As a: [role]
I want: [action]
So that: [business outcome]

Acceptance Criteria:
  AC1: [testable condition]
  AC2: [testable condition]

Dependencies:
  - Backend: [what is needed]
  - Frontend: [what is needed]
  - Security: [if compliance-relevant]

Effort: S / M / L
Definition of Done:
  - [ ] Backend implemented and Tech Lead reviewed
  - [ ] Frontend implemented and Tech Lead reviewed
  - [ ] Automation Tester tests written and passing
  - [ ] Security Architect reviewed (if compliance-relevant)
  - [ ] Sayan approved before merge
```

---

## Pre-Written Stories (Draft — Awaiting Sayan Approval)

### Epic: Fraud Detection (Nolyvra Verify)

**STORY: FD-01 — Rename Fraud Detection as "Nolyvra Verify"**
Priority: Now | Effort: S
```
As a recruiter, I want to see "Nolyvra Verify" as the label for fraud detection features
So that the feature has a clear, marketable identity

AC1: All UI references to "fraud detection" updated to "Nolyvra Verify"
AC2: Analysis page section header reads "Nolyvra Verify — Fraud & Risk Assessment"
AC3: No backend changes required

Dependencies: Frontend only
```

**STORY: FD-02 — Fraud Score on Candidate List**
Priority: Now | Effort: S+S
```
As a recruiter, I want to see fraud risk level on the candidate list
So that I can triage high-risk candidates without opening each profile

AC1: CandidatesPage shows a "Verify" column with colour-coded risk (Low/Medium/High/Critical)
AC2: Green=Low, Amber=Medium, Red=High, Dark Red=Critical
AC3: Clicking risk badge opens candidate's Verify section directly
AC4: If no analysis run, shows "Not analysed" with link to run
AC5: Column is sortable and filterable

Dependencies:
  - Backend: Return fraud_risk_level in candidate list API response
  - Frontend: New column in CandidatesPage DataGrid
```

**STORY: FD-03 — Client-Deliverable Fraud & Consistency PDF Report**
Priority: Now | Effort: M
```
As a recruiter, I want to generate a branded PDF of a candidate's Verify results
So that I can include it in client submissions as evidence of due diligence

AC1: "Download Verify Report" button on candidate analysis page
AC2: PDF contains: candidate name, analysis date, fraud risk level, top 3 risk signals, consistency score breakdown, Nolyvra Verify branding
AC3: PDF does not expose internal model weights
AC4: Generates within 10 seconds
AC5: Named: "NolyvraVerify_[CandidateName]_[Date].pdf"

Dependencies:
  - Backend: New PDF generation endpoint (iText or Apache PDFBox)
  - Frontend: Download button on AnalysisPage
```

---

### Epic: Compliance

**STORY: CO-01 — GDPR Candidate Consent Flag**
Priority: Next | Effort: S-M
```
As an agency owner, I want each candidate to have a consent record
So that the agency can demonstrate GDPR compliance if audited

AC1: Candidate record has consent_timestamp and consent_text fields
AC2: Adding a candidate records timestamp and default consent text
AC3: Recruiter can view and update consent status on candidate profile
AC4: Candidates with consent_withdrawn cannot have new analyses run

Dependencies:
  - Backend: V12__gdpr_consent.sql migration, CandidateService + Controller update
  - Frontend: Consent display on candidate profile, consent checkbox on AddCandidatePage
  - Security Architect: Must review before implementation
```

**STORY: CO-02 — GDPR Right to Erasure**
Priority: Next | Effort: S
```
As a recruiter, I want to permanently delete a candidate and all their data
So that the agency can comply with erasure requests under UK GDPR

AC1: "Delete Candidate" available on profile behind confirmation dialog
AC2: Deletes: candidate record, all analyses, all CV data, all email history
AC3: Deletion logged with timestamp and recruiter ID (not the candidate data)
AC4: No recovery possible after deletion

Dependencies:
  - Backend: Cascade delete, audit_log entry
  - Frontend: Confirmation modal
  - Security Architect: Must review cascade delete scope
```

**STORY: CO-03 — EU AI Act Audit Trail**
Priority: Next | Effort: S (August 2026 deadline)
```
As the system, I want to log every automated screening decision with full context
So that the agency can produce audit evidence if required by regulators

AC1: Every AI analysis creates an audit_log entry: candidate_id, timestamp, ai_model_version, fraud_risk_level, consistency_score, placement_probability, recruiter_login_id
AC2: Audit log is append-only
AC3: Read-only export endpoint for agency admin only
AC4: Entries retained minimum 3 years

Dependencies:
  - Backend: V13__audit_log.sql migration, write in AnalysisService
  - Security Architect: Must review access control and retention
```

---

### Epic: Client Portal

**STORY: CP-01 — Shareable Candidate Shortlist Link**
Priority: Next | Effort: M
```
As a recruiter, I want to generate a shareable link to a candidate shortlist
So that a hiring manager can review candidates without needing a Nolyvra login

AC1: Select 2-10 candidates and click "Share with Client"
AC2: Generates a unique URL, valid for 14 days
AC3: Read-only view shows: name, role, placement probability, fraud risk level, recruiter note
AC4: No login required for the hiring manager
AC5: Recruiter can revoke the link before expiry
AC6: Expired links show a clear "link expired" message
AC7: Nolyvra brand visible on the shared view (virality)

Dependencies:
  - Backend: New shared_links table, generate/serve endpoint
  - Frontend: Share button on CandidatesPage, new SharedShortlistPage
  - Security: Cryptographically random tokens, not guessable IDs
```

---

### Epic: Core Platform

**STORY: PL-01 — Placement Outcome Tracking**
Priority: Now | Effort: S
```
As a recruiter, I want to mark a candidate as placed and record the fee
So that Nolyvra can track real outcomes to improve placement probability scoring

AC1: "Mark as Placed" action on final pipeline stage
AC2: Prompts for: placement date, fee (optional, GBP), client name
AC3: Placed candidates show "Placed" badge on candidate list
AC4: Dashboard shows total placements this month and total fees placed

Dependencies:
  - Backend: New fields on candidate record (placed, placement_date, placement_fee, placed_client), migration
  - Frontend: Action in CandidateWorkflowPage, dashboard widget update
```

---

## Backlog Priority Summary (for Tech Lead)

| ID | Story | Epic | Priority | Effort |
|---|---|---|---|---|
| FD-01 | Rename to Nolyvra Verify | Fraud Detection | Now | S |
| FD-02 | Fraud score on candidate list | Fraud Detection | Now | S+S |
| FD-03 | Client-deliverable fraud PDF | Fraud Detection | Now | M |
| PL-01 | Placement outcome tracking | Core Platform | Now | S |
| CO-01 | GDPR consent flag | Compliance | Next | S-M |
| CO-02 | GDPR right to erasure | Compliance | Next | S |
| CO-03 | EU AI Act audit trail | Compliance | Next | S |
| CP-01 | Shareable shortlist link | Client Portal | Next | M |

---

## Rules of Engagement

- Minimum viable scope only — no gold plating
- Every schema change needs a new versioned migration (Backend Engineer's responsibility)
- Every story touching PII or auth needs Security Architect review before work begins
- Never hand a story to an engineer without Sayan's approval
- Flag immediately if scope creeps during implementation
