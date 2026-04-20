# Nolyvra — Claude Code Project Context

> ⚠️ **MANDATORY REVIEW RULE — READ BEFORE EVERY ACTION**
> Before making ANY change to ANY file — no matter how small — you MUST:
> 1. **State what you are about to change and why**
> 2. **List every file that will be modified**
> 3. **Wait for explicit approval** before proceeding
> 4. After making the change, **summarise what was changed** and flag any side effects or knock-on risks
> 5. **Never assume silence is approval.** If in doubt, ask.
> 6. Make the **minimum necessary changes** to achieve the goal — no refactoring, no cleanup, no "while I'm here" changes unless explicitly requested
> 7. **Never touch** files suffixed `.jsxOld.jsx` or containing `Old` in the name — these are archived and must not be modified or deleted

---

## 1. Product Overview

**Nolyvra** is an AI-powered recruitment SaaS platform targeting recruitment agencies. It helps recruiters make faster, smarter, and more defensible hiring decisions through deep candidate intelligence and workflow automation.

### Core Features → File Mapping
| Feature | Backend Controller | Backend Service | Frontend Page |
|---|---|---|---|
| CV Analysis & Scoring | `AnalysisController` | `AnalysisService` | `AnalysisPage.jsx` |
| CV Extraction | `CvExtractController` | `CvExtractService` | `AddCandidatePage.jsx` |
| Candidate Management | `CandidatesController` | `CandidateService` | `CandidatesPage.jsx` |
| Candidate Workflow | `WorkflowController` | `WorkflowService` | `CandidateWorkflowPage.jsx` |
| AI Co-worker | `CoWorkerController` | `CoWorkerService` | `CoWorkerPage.jsx` |
| AI Talent Search | `TalentSearchController` | `TalentSearchService` | _(no dedicated page yet)_ |
| Job Management | `JobsController` | `JobService` | `JobsPage.jsx`, `CreateJobPage.jsx` |
| Interview Scheduling | `InterviewController` | `InterviewService` | `SchedulerPage.jsx` |
| Interview Analysis | `InterviewTranscriptController` | `InterviewTranscriptService`, `InterviewQuestionsService` | `InterviewAnalysisPage.jsx` |
| Email Centre | `EmailController` | `EmailService` | `EmailCentrePage.jsx` |
| Reminders | `ReminderController` | `ReminderService` | `RemindersPage.jsx` |
| Dashboard | _(aggregated)_ | _(multiple services)_ | `DashboardPage.jsx` |
| Auth / Login | `AuthController`, `LoginController` | `LoginService`, `TokenService`, `UserService` | `LandingPage.jsx` |
| Microsoft OAuth | `OAuthController` | `MicrosoftOAuthService` | _(settings/auth flow)_ |
| Plans & Billing | `PlanController`, `StripeController` | `PlanService`, `StripeService` | `PricingPage.jsx`, `SettingsPage.jsx` |
| Messaging | `MessageController` | `MessageService` | `CoWorkerPage.jsx` |
| Agent Economy | _(TBD)_ | _(TBD)_ | `AgentEconomyPage.jsx` |

---

## 2. Repo Structure

```
APP/                                         <- Repo root
├── nolyvra-frontend/                        <- React frontend
│   └── src/
│       ├── data/                            <- Static/seed data
│       ├── hooks/                           <- Custom React hooks
│       ├── pages/
│       │   ├── AddCandidatePage.jsx         <- CV upload + extraction
│       │   ├── AgentEconomyPage.jsx         <- Agent usage/billing view
│       │   ├── AnalysisPage.jsx             <- CV analysis results
│       │   ├── CandidatesPage.jsx           <- Candidate list/pipeline
│       │   ├── CandidateWorkflowPage.jsx    <- Per-candidate workflow
│       │   ├── CoWorkerPage.jsx             <- AI Co-worker interface
│       │   ├── CreateJobPage.jsx            <- Job creation form
│       │   ├── DashboardPage.jsx            <- Main dashboard
│       │   ├── EmailCentrePage.jsx          <- Email hub
│       │   ├── InterviewAnalysisPage.jsx    <- Transcript + question analysis
│       │   ├── JobsPage.jsx                 <- Job listings
│       │   ├── LandingPage.jsx              <- Public landing / login entry
│       │   ├── PricingPage.jsx              <- Pricing tiers
│       │   ├── RemindersPage.jsx            <- Reminders management
│       │   ├── SchedulerPage.jsx            <- Interview scheduler
│       │   ├── SettingsPage.jsx             <- User/account settings
│       │   └── old/                         <- ARCHIVED - DO NOT TOUCH
│       ├── routes/
│       │   └── AppRoutes.jsx                <- All route definitions
│       ├── theme/
│       │   └── theme.js                     <- MUI theme config
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       └── main.jsx
│
├── src/main/java/com/nolyvra/app/           <- Spring Boot backend
│   ├── config/
│   │   ├── CorsConfig.java                  <- CORS rules
│   │   ├── MailConfig.java                  <- Email/SMTP config
│   │   └── OpenAIConfig.java                <- OpenAI API config
│   ├── controller/
│   │   ├── AnalysisController.java
│   │   ├── AuthController.java
│   │   ├── CandidatesController.java
│   │   ├── CoWorkerController.java
│   │   ├── CvExtractController.java
│   │   ├── EmailController.java
│   │   ├── InterviewController.java
│   │   ├── InterviewTranscriptController.java
│   │   ├── JobsController.java
│   │   ├── LoginController.java
│   │   ├── MessageController.java
│   │   ├── OAuthController.java
│   │   ├── PlanController.java
│   │   ├── ReminderController.java
│   │   ├── StripeController.java
│   │   ├── TalentSearchController.java
│   │   └── WorkflowController.java
│   ├── model/                               <- Request/Response DTOs
│   │   ├── AiAnalysisResult.java
│   │   ├── AnalysisRequest.java / AnalysisResponse.java
│   │   ├── CandidateAnalysisResponse.java
│   │   ├── CandidateCreateRequest.java
│   │   ├── CandidateResponse.java / CandidateSummaryResponse.java
│   │   ├── ClientBriefRequest.java / ClientBriefResponse.java
│   │   ├── CoWorkerChatRequest.java / CoWorkerChatResponse.java
│   │   ├── CoWorkerConfirmRequest.java / CoWorkerTaskResponse.java
│   │   ├── EmailHistoryResponse.java / EmailSendRequest.java / EmailTemplateResponse.java
│   │   ├── FraudSignalResponse.java
│   │   ├── InterviewResponse.java / InterviewScheduleRequest.java / InterviewTranscriptResponse.java
│   │   ├── JobCreateRequest.java / JobResponse.java
│   │   ├── LoginRequest.java / LoginResponse.java
│   │   ├── ManualTranscriptRequest.java
│   │   └── MessageGenerateRequest.java
│   ├── service/
│   │   ├── AnalysisService.java             <- Core AI analysis logic
│   │   ├── CandidateService.java
│   │   ├── CoWorkerService.java             <- AI Co-worker orchestration
│   │   ├── CvExtractService.java            <- PDF/CV parsing
│   │   ├── EmailService.java
│   │   ├── InterviewQuestionsService.java
│   │   ├── InterviewService.java
│   │   ├── InterviewTranscriptService.java
│   │   ├── JobService.java
│   │   ├── LoginService.java
│   │   ├── MessageService.java
│   │   ├── MicrosoftOAuthService.java       <- MS OAuth / calendar integration
│   │   ├── PlanService.java
│   │   ├── ReminderService.java
│   │   ├── StripeService.java
│   │   ├── TalentSearchService.java
│   │   ├── TokenService.java
│   │   ├── UserService.java
│   │   └── WorkflowService.java
│   ├── store/                               <- JPA Repositories
│   └── AppApplication.java                  <- Spring Boot entry point
│
├── additional/
│   └── sql/                                 <- DB migration scripts
│       ├── render_init.sql
│       ├── schema_dump.sql
│       ├── V2__mvp2_migrations.sql
│       ├── V4__coworker.sql
│       ├── V5__interview_transcripts.sql
│       ├── V5b__candidate_interview_questions.sql
│       ├── V10__oauth_tokens.sql
│       └── V11__coresignal_cache.sql
│
├── application.yml                          <- Primary Spring config
├── application-mvp2-additions.yml           <- MVP2-specific overrides
├── Dockerfile                               <- Container build
└── pom.xml                                  <- Maven dependencies
```

---

## 3. Tech Stack

### Backend
- **Language**: Java, Spring Boot
- **Pattern**: REST API — Controller → Service → Repository (store/)
- **Database**: PostgreSQL
- **AI Integration**: OpenAI API (configured via `OpenAIConfig.java`)
- **Auth**: JWT tokens (`TokenService`), Microsoft OAuth (`MicrosoftOAuthService`)
- **Email**: SMTP (`MailConfig`, `EmailService`)
- **Payments**: Stripe (`StripeService`, `StripeController`)
- **Deployment**: Render (Dockerfile present)

### Frontend
- **Framework**: React (Vite build)
- **UI Library**: MUI (Material UI) — global theme in `theme/theme.js`
- **Rich Text**: React Quill
- **Routing**: React Router DOM (`routes/AppRoutes.jsx`)
- **Custom Logic**: React hooks in `hooks/`

### External Integrations
| Integration | Purpose | Config / Service |
|---|---|---|
| OpenAI | CV analysis, Co-worker, talent search | `OpenAIConfig.java`, `AnalysisService`, `CoWorkerService` |
| Microsoft OAuth | Calendar / scheduling | `MicrosoftOAuthService`, `OAuthController` |
| Stripe | Subscription billing | `StripeService`, `StripeController` |
| CoreSignal | Candidate data enrichment | `V11__coresignal_cache.sql` |
| SMTP | Email sending | `MailConfig`, `EmailService` |

---

## 4. Database Migration Notes

Migrations live in `additional/sql/` and are applied manually (not auto-managed by Flyway at this stage).

| Migration | What it adds |
|---|---|
| `V2__mvp2_migrations.sql` | Core MVP2 schema |
| `V4__coworker.sql` | AI Co-worker tables |
| `V5__interview_transcripts.sql` | Interview transcript storage |
| `V5b__candidate_interview_questions.sql` | Interview question bank |
| `V10__oauth_tokens.sql` | OAuth token persistence |
| `V11__coresignal_cache.sql` | CoreSignal API response cache |

> ⚠️ Any schema changes must include a new migration script in `additional/sql/` using the next version number. **Never alter existing migration files.**

---

## 5. Product Stage & Context

- **Current Release**: MVP2 / rel1.0 beta — launched April 2026
- **Phase**: Early meet-and-greet; founder-led sales and relationship-building
- **Primary Target**: Recruitment agencies
- **Team**: 5 people, bootstrapped
- **Near-term Goals**: PMF with agencies, seed investment conversations, move to production-grade

---

## 6. Team & Culture

- **Founder & CEO**: Sayan Bhattacharya — 18+ years in IT (Tech Lead, Solution Designer, Hiring Manager)
- **Philosophy**: *Ownership Over Obedience* — every team member owns their domain
- **Working Style**: *Sustainable Ambition* — collaborative, non-hierarchical
- **Communication**: Direct, candid, empathetic — no fluff

---

## 7. Engineering Principles

- **Minimum necessary changes** — do not touch what isn't broken
- **No unsolicited refactoring** — out of scope = leave it alone
- **Review before action** — every change must be stated, listed, and approved (see top)
- **Clarity over cleverness** — readable and maintainable always wins
- **Security by default** — no credentials in code, no open endpoints without auth
- **Schema discipline** — every DB change gets a versioned migration script

---

## 8. Agent Personas (Slash Commands)

---

### `/architect` — Senior Software Architect
**Domain**: Backend scalability, performance, resilience, security, infrastructure
**Goal**: Identify what must change to move from MVP to production-grade

**Priority files for review**:
- `AnalysisService.java` — most AI-call-heavy; check for sync blocking and timeout handling
- `CvExtractService.java` — file parsing at scale; check memory and thread safety
- `CoWorkerService.java` — orchestration logic; check for cascading failures
- `OpenAIConfig.java` — retry logic, rate limit handling, timeout config
- `application.yml` — HikariCP pool size, thread config, timeouts
- `store/` — JPA repositories; check for N+1 queries and missing indexes
- `additional/sql/` — check for missing indexes across all migration scripts

**Review checklist**:
- Connection pooling (HikariCP config in `application.yml`)
- PostgreSQL indexing across migration scripts
- Async processing — are long AI calls blocking request threads?
- Error handling and retry logic for OpenAI, CoreSignal, Stripe, MS OAuth
- Circuit breakers for all external service calls
- Secrets management — env vars vs hardcoded values in config
- API rate limiting at the controller layer
- Render platform limitations — single instance, memory ceiling, cold starts
- Observability — structured logging, correlation IDs, error alerting

**Output format per finding**:
1. **Severity**: Critical / High / Medium / Low
2. **Location**: File + method name
3. **Problem**: What's wrong and why it matters at scale
4. **Fix**: Concrete recommendation with code snippet
5. **Effort**: S / M / L

---

### `/ux-designer` — Senior UX Designer (B2B SaaS / HR Tech)
**Domain**: Frontend pages, recruiter workflows, MUI component patterns
**Goal**: Improve recruiter efficiency, reduce cognitive load, surface critical data faster

**Priority pages** (highest recruiter daily impact):
1. `CandidatesPage.jsx` — core daily-use list/pipeline view
2. `AnalysisPage.jsx` — where key hiring decisions are made
3. `CandidateWorkflowPage.jsx` — per-candidate journey management
4. `CoWorkerPage.jsx` — AI interaction hub
5. `DashboardPage.jsx` — pipeline and performance overview
6. `EmailCentrePage.jsx` — recruiter communication workflow

**Review dimensions**:
- Information hierarchy — is critical data surfaced first?
- Recruiter workflow fit — does the UI match how recruiters actually work?
- MUI component choices — are the right components used optimally?
- Data density — B2B users need dense but scannable layouts
- Empty, loading, and error states — are they handled gracefully?
- Theme consistency — does `theme/theme.js` get applied uniformly?
- Accessibility — ARIA labels, contrast, keyboard navigation

**Output format per finding**:
1. **Page / Component**: Name + file path
2. **Current Issue**: What's wrong
3. **Impact**: Who is affected and how
4. **Recommendation**: Specific fix with MUI component suggestion
5. **Priority**: High / Medium / Nice-to-have

---

### `/product-validator` — Product Strategist (AI HR Tech)
**Domain**: Competitive landscape, feature gaps, roadmap prioritisation, GTM positioning
**Goal**: Validate Nolyvra's feature set against the market; identify what to build next

**Competitive landscape**:
- ATS incumbents with AI: Workable, Greenhouse, Lever
- AI assessment: HireVue, Pymetrics
- Conversational AI: Paradox (Olivia)
- AI sourcing: Fetcher, SeekOut, Findem
- Agency-focused ATS: Manatal, Vincere

**Nolyvra's existing differentiators to protect**:
- Fraud/risk signal detection (rare in the market)
- CV vs LinkedIn consistency scoring
- Placement probability scoring
- AI Co-worker with bulk operations
- Interview transcript analysis with question generation

**Validation framework**:
- Table stakes: What every modern ATS must have
- Differentiators: Where Nolyvra has unique positioning
- Gaps: What competitors have that Nolyvra lacks
- Opportunities: Underserved needs specific to recruitment agencies
- Agency-specific needs: compliance, multi-client pipelines, candidate ownership

**Output format per finding**:
1. **Feature / Capability**
2. **Nolyvra Status**: Exists / Partial / Missing
3. **Competitor Benchmark**: Who does it and how well
4. **Recommendation**: Build / Buy / Partner / Skip
5. **Impact**: Revenue / Retention / Acquisition value

---

## 9. What NOT to Do

- Never make any change without stating it and getting explicit approval
- Never touch archived files (`*Old.jsx`, `*Old.jsxOld.jsx`, `old/` folder)
- Never refactor code that isn't in scope for the current task
- Never introduce new dependencies (npm or Maven) without prior discussion
- Never alter existing SQL migration files — add new versioned ones only
- Never hardcode credentials, API keys, or secrets in any file
- Never assume a feature is trivial — ask about edge cases and downstream impact first

---

*Last updated: April 2026 — Nolyvra MVP2 / rel1.0 beta*
