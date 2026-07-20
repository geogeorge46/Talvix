# Talvix Product Blueprint

## 1. Document Information

| Field | Value |
| --- | --- |
| Document title | Talvix Product Blueprint |
| Version | 0.1 |
| Status | Draft |
| Last updated | 2026-07-19 |
| Product | Talvix |
| Purpose | Establish an evidence-based view of the current product, distinguish implemented capability from inferred and recommended scope, and provide a decision framework for MVP design. |

### Evidence labels

- **Existing** means backend code, routes, models, tests, or repository documentation directly support the capability. It does not imply a frontend exists.
- **Planned/inferred** means repository boundaries, fields, comments, or absent integrations suggest an intended capability, but it is not implemented end to end.
- **Recommended** is a product proposal, not a repository fact.
- **Decision required** identifies an assumption that the product owner must confirm.

## 2. Product Vision

**One-sentence vision:** Talvix helps candidates and verified employers make structured, transparent hiring decisions using skills, retained evidence, and human-reviewed assistance.

### Product description

Talvix is an evidence-based recruitment and applicant-tracking platform. The implemented backend supports candidate profiles, verified organizations, jobs, applications, assessments, structured interviews, offers, private documents, notifications, and administrative oversight. The frontend is explicitly deferred. AI, GitHub integration, messaging, billing, external calendars/video, and centralized audit logs are not currently implemented.

### Problem and users

Conventional job portals overemphasize titles, credentials, and keyword matching while giving candidates little process visibility and hiring teams weak decision structure. Talvix serves job seekers, organization hiring teams, organization owners, and Talvix administrators. It combines declared skills with evidence such as profile history, resumes, project links, assessment results, interview scorecards, and immutable workflow snapshots.

### Value proposition

- Candidates receive a traceable application journey, explicit eligibility rules, controlled profile privacy, and safe access to assessments, interviews, and offers.
- Hiring teams receive structured workflows, permission-scoped collaboration, deterministic skill matching, evidence review, scorecards, and aggregate operational analytics.
- Organizations receive verified tenancy, team permissions, reusable templates, retained workflow evidence, and consistent approval controls.
- Platform administrators receive governance queues, corrective controls, document oversight, notification operations, and privacy-safe aggregate analytics.

Talvix differs from a conventional portal by prioritizing evidence and structured evaluation over simple listing-and-apply flows. Its current matching is deterministic rather than AI-driven; AI assistance is a future vision and must remain explainable and subordinate to human decisions.

### Product principles

1. Skills over credentials.
2. Evidence over self-claims.
3. Explainable assistance over black-box decisions.
4. Fair and accessible hiring.
5. Clear recruiter workflows and accountable transitions.
6. Candidate transparency without exposing private evaluator data.
7. Privacy, tenant isolation, and security by design.
8. Human accountability for hiring outcomes.
9. Immutable snapshots for consequential decisions.
10. Graceful degradation when optional providers fail.

## 3. Product Scope

### Core product scope

The core product is a multi-tenant hiring workflow from account registration through hiring: candidate profile and documents; recruiter approval and company verification; job creation and publication review; job discovery and application; deterministic skill comparison; applicant tracking; assessments; structured interviews; offers; notifications; and administrative governance.

### Release boundaries

| Horizon | Scope |
| --- | --- |
| **Existing backend** | Authentication; candidate/recruiter profiles; companies and team permissions; jobs; applications/ATS; assessments; interviews; offers; notifications/email outbox; document delivery and verification; admin analytics and domain-specific corrections. |
| **MVP product** | Add a usable responsive frontend over a deliberately reduced end-to-end workflow: candidate, recruiter-admin, and platform admin; one organization per recruiter owner; jobs, applications, simple pipeline, objective assessment, interview scheduling/scorecard, offer response, notifications. |
| **Post-MVP** | Rich hiring subroles and saved views, calendar integrations, improved reporting, resume extraction, explainable candidate summaries, organization settings, richer document verification, optional email production operations. |
| **Long term** | Consented GitHub/project verification, responsible AI assistance, integrations, enterprise governance, institution/campus workflows, billing, data portability, and scalable analytics. |

### Out of scope for the first release

Real-time chat, video interviewing, calendar OAuth, electronic signatures, payroll, payments/billing, background checks, automated malware claims, OCR, automatic code execution, autonomous AI hiring decisions, social-network features, staffing-agency marketplace, and native mobile apps should remain out of the first release. The repository explicitly excludes frontend features, workers, and AI from its current backend scope; an MVP UI is a future delivery, not current functionality.

## 4. User Types and Role Model

### Current repository role model

The `User` model has three top-level roles: `candidate`, `recruiter`, and `admin`. Public registration permits candidate and recruiter. Organization ownership is represented by `RecruiterProfile.isCompanyOwner`, the company `owner`, and an owner team membership with all recruiter permissions. Team member `role` is a free-text label; authority comes from persisted permissions and active membership.

### Candidate

- **Purpose:** participate in hiring while controlling personal evidence.
- **Goals:** build a credible profile, find suitable jobs, apply, complete evaluations, track progress, and respond to offers.
- **Responsibilities:** provide accurate information, manage consent/visibility, meet deadlines, and protect account access.
- **Allowed:** own profile CRUD, resume/photo and permitted workflow documents, public job/company discovery, own applications, assessments, availability, interviews, notifications, and offers.
- **Restricted:** other candidates, private recruiter notes, hidden assessment answers/tests, private interview feedback, internal offer approval, company controls, and platform administration.
- **Dashboard:** profile completion, recommended/recent jobs (recommendation is future), active applications, deadlines, upcoming interviews, offers, unread notifications.
- **Pain points:** repeated data entry, opaque rejection, uncertain status, inaccessible assessments, and privacy concerns.

### Hiring Team Member

- **Purpose:** operate hiring workflows for one verified organization.
- **Goals:** publish roles, review evidence, coordinate stages, evaluate consistently, and hire efficiently.
- **Responsibilities:** use lawful criteria, protect candidate data, document decisions, and act only within assigned permissions.
- **Allowed:** permission-dependent job, application, assessment, interview, offer, document, and team actions.
- **Restricted:** cross-company data, platform governance, actions without active membership/approved profile/verified company, and capabilities outside assigned permissions.
- **Dashboard:** assigned candidates, jobs needing attention, stage aging, assessment reviews, interviews, approvals, offer deadlines, notifications.
- **Pain points:** fragmented evidence, inconsistent reviews, scheduling, handoffs, and unclear ownership.

**Subrole recommendation:** keep one top-level hiring-team account type and add reusable permission presets: Recruiter, Hiring Manager, Interviewer, Technical Evaluator, and Viewer. Do not create separate account types. The current permission architecture supports presets, although the repository does not yet define or enforce named presets.

### Organization Owner

- **Purpose:** administer the organization workspace while retaining hiring capability.
- **Goals:** configure the company, control membership and permissions, govern publication/approvals, and understand hiring performance.
- **Responsibilities:** verify company details, manage least-privilege access, oversee data handling, and eventually manage billing.
- **Allowed:** currently all recruiter permissions through owner membership, including company/team management. Billing is not implemented.
- **Restricted:** platform-wide administration and other tenants; ownership transfer/deletion is not evidenced and is **Decision required**.
- **Dashboard:** verification state, team access, active jobs, pipeline health, pending approvals, storage/notification health as appropriate, and future billing.
- **Pain points:** governance overhead, permission risk, adoption, compliance, and cost visibility.

The owner is separate conceptually because workspace governance, team access, and commercial accountability differ from daily candidate evaluation. It need not be a separate top-level `User.role`; the repository's owner-as-privileged-membership approach is the recommended scalable pattern.

### Platform Administrator

- **Purpose:** govern Talvix across tenants.
- **Goals:** keep the platform trustworthy, resolve exceptional states, approve actors and content, and monitor safe aggregate health.
- **Responsibilities:** recruiter/company/job review, moderation/corrections, document oversight, support, security, notification operations, and aggregate analytics.
- **Allowed:** domain-specific admin queues and corrections; platform analytics/export; notification/outbox/template operations.
- **Restricted:** using private candidate data without a support/governance purpose; raw file bypass; final hiring decisions; centralized audit-log access is not implemented.
- **Dashboard:** approval queues, suspicious/failed document states, notification backlog, workflow exceptions, aggregate conversion, and platform health.
- **Pain points:** false positives, limited audit consolidation, support context, and balancing privacy with governance.

### MVP and scalable recommendation

- The MVP needs three sign-in roles: Candidate, Recruiter, and Platform Administrator.
- Organization Owner should initially be the first recruiter with recruiter-admin permissions, as already modeled.
- Interviewer/evaluator/viewer should be permission presets within Hiring Team Member, introduced only when multi-member workflows are in MVP scope.
- Long term, retain three account types and model organization-scoped memberships with named presets plus granular overrides. Separate identity role, tenant membership, and permissions. Add ownership transfer and at least one protected owner per tenant.

## 5. Permission Matrix

Legend: `V/C/E/D/A/M` = View/Create/Edit/Delete/Approve/Manage. “Own” is self-owned data; “Perm.” means organization permission required.

| Capability | Candidate | Hiring team member | Organization owner | Platform administrator | Evidence/status |
| --- | --- | --- | --- | --- | --- |
| Profile management | V/E own | V/E own; V candidate if visible | Same as team | V governed profiles; corrections limited | Existing |
| Resume upload | C/V/E/D own | V submitted evidence with permission | Same as team | Metadata/oversight; no raw bypass | Existing |
| GitHub connection | Decision required | Decision required | Decision required | Governance future | Not implemented |
| Project submission | C/E/D own profile entries | V visible profile | Same as team | V as permitted | Existing as profile data; verification absent |
| Job browsing | V public | V public/company | V | V | Existing |
| Job application | C own | — | — | Inspect/correct | Existing |
| Application withdrawal | E own eligible | — | — | Correct with reason | Existing |
| Assessment participation | C/E/submit own assigned | — | — | Inspect/correct | Existing |
| Interview participation | V/respond own; availability | V/evaluate if assigned and permitted | Same | Inspect/correct | Existing |
| Job creation/editing | — | C/E with `jobs.create/update` | M | Inspect | Existing |
| Job publishing | — | Submit/manage with permission; direct approval unclear in UI | Same | A pending jobs | Existing requires admin approval |
| Candidate review | — | V/rate/tag/note with permission | M | Inspect/moderate | Existing |
| Candidate stage movement | Withdraw/respond only | E with `applications.manage` | M | Correct with reason | Existing |
| Assessment creation | — | C/E/D/publish with permission | M | Inspect/correct assignments | Existing |
| Interview scheduling | Respond/availability | C/E with `interviews.schedule` | M | Correct/cancel | Existing |
| Interview evaluation | Participate only | C/E/submit with `interviews.evaluate` | M | Reopen with reason | Existing |
| Offer creation | Respond/negotiation | C/E with `offers.manage` | M | Inspect/correct | Existing |
| Offer approval/send | Accept/decline/request negotiation | A/send with distinct permissions | M | Correct; not routine approver | Existing |
| Organization profile | V public | E with `company.manage` | M | A/reject/suspend | Existing |
| Team invitation/member add | — | M with `team.manage` | M | — | Existing add-member flow; invitation delivery semantics unclear |
| Team role/permission management | — | M with `team.manage` | M | — | Existing |
| Billing management | — | — | Decision required | Decision required | Not implemented |
| Company verification | — | Submit implicitly by creation; view status | Same | A/reject/suspend | Existing; needs-information absent |
| User suspension | — | — | Decision required for tenant removal only | M recruiter; general candidate suspension route unclear | Partial/decision required |
| Moderation | Report future | Private-note management only | Same | Domain corrections and note moderation | Partial; reporting system absent |
| Audit-log access | Own timelines only | Domain histories | Domain histories | Domain histories; centralized log absent | Partial |
| Platform analytics | — | — | — | V/export aggregate | Existing |

## 6. Personas

| Persona | Background | Goals | Frustrations | Technical comfort | Primary tasks | Success criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Final-year student, Ananya | MCA student with projects but little formal experience | Prove skills; obtain first role | Credential bias; unclear status; repeated forms | High | Complete profile, add projects, upload resume, apply, assess, interview | Finishes applications confidently and receives transparent next steps |
| Experienced candidate, Vikram | Backend engineer with 6 years' experience | Find relevant roles discreetly | Poor matching; privacy; irrelevant outreach | High | Set recruiter-only visibility, document experience, compare jobs, manage interviews/offers | High-quality opportunities with controlled disclosure |
| Campus recruiter, Meera | Recruiter managing several entry-level roles | Process volume consistently | Spreadsheets, duplicate follow-up, missed deadlines | Medium | Publish jobs, filter applicants, assign assessments, move stages | Faster review with no lost candidates and auditable stages |
| Technical interviewer, Arjun | Senior engineer interviewing part-time | Evaluate consistently with minimal admin | Vague rubrics; schedule conflicts; context switching | High | Review candidate context, set availability, submit scorecard | Complete structured feedback promptly without seeing unrelated private data |
| Organization owner/HR lead, Sana | HR lead at a growing firm | Control access and hiring quality | Permission sprawl; poor reporting; compliance risk | Medium | Verify company, manage team, oversee jobs/offers and metrics | Least-privilege team and predictable end-to-end process |
| Platform administrator, Dev | Talvix trust and operations lead | Maintain safe, reliable platform | Scattered exceptions; false positives; support burden | High | Review queues, corrections, notification operations, analytics | Timely resolution, traceable actions, low privacy exposure |

## 7. Information Architecture

### Product hierarchy

1. **Public website:** product information (recommended), public companies and published jobs (existing API), legal/help (recommended).
2. **Authentication:** register, login, refresh/session recovery, logout; password reset/email verification are not evidenced.
3. **Onboarding:** candidate profile completion; recruiter approval; company creation and verification.
4. **Candidate workspace:** profile/evidence, discovery, applications, assessments, interviews, offers, documents, notifications, settings.
5. **Organization workspace:** overview, jobs, candidates/applications, assessments, interviews, offers, company/team, documents, analytics, settings.
6. **Administration workspace:** approval and moderation queues, domain oversight, notifications, aggregate analytics, health.
7. **Shared areas:** account, notifications, permission/session states, support, privacy controls.

### Role sitemaps

**Public**

- Home (recommended)
- Jobs → search → job detail (API existing)
- Companies → directory → company detail (API existing)
- About, accessibility, privacy, terms, help (recommended)
- Sign in / register

**Candidate**

- Dashboard
- Profile → overview, education, skills, experience, projects, certifications, preferences, visibility
- Documents → resume, photo, retained workflow documents
- Jobs → browse, detail
- Applications → list, detail/timeline
- Assessments → assignments, attempt, result
- Interviews → schedule, availability, process detail
- Offers → list, detail, negotiation/response
- Notifications → inbox, preferences
- Settings → account, privacy, security, data rights (partly future)

**Hiring team / owner**

- Overview
- Jobs → managed jobs, editor, review state, job analytics
- Candidates / Applications → search, pipeline, application detail
- Assessments → question bank, templates, assignments, reviews, statistics
- Interviews → templates, processes, calendar, availability, feedback, analytics
- Offers → templates, drafts, approvals, active offers, analytics
- Documents → workflow evidence, verification queue
- Company → profile, verification
- Team & permissions (permission-gated)
- Notifications
- Settings; billing later

**Platform administrator**

- Overview / health
- Recruiter approvals
- Company verification
- Job review
- Applications / assessments / interviews / offers oversight
- Document oversight
- Notification templates, outbox, email logs
- Analytics and exports
- Audit log (recommended; not existing)
- Users/moderation/support (partial/future)

## 8. Navigation Model

| User | Primary sidebar | Secondary tabs | Global actions |
| --- | --- | --- | --- |
| Candidate | Dashboard, Jobs, Applications, Assessments, Interviews, Offers, Profile | Status/result/timeline tabs within workflow | Search jobs, update profile, notification bell |
| Hiring team | Overview, Jobs, Applications, Assessments, Interviews, Offers, Documents | List/pipeline/calendar/templates/reviews/analytics according to module | Create job, search candidates, assign assessment, schedule interview |
| Owner | Hiring-team navigation plus Company and Team | Profile, verification, members, permissions; billing later | Invite/add member, manage company |
| Admin | Overview, approval queues, domains, notifications, analytics, health | Pending/resolved/status breakdowns | Global scoped search, export aggregate report |

The account menu should contain profile, workspace switcher if multi-company support is later added, notification preferences, security, help, and logout. Notification access should be global for authenticated users. Search must be contextual: public jobs/companies; recruiter candidate/application search; admin scoped entity search. Permission-only items should be hidden from navigation but direct URLs must still return a clear denied state.

On mobile, use a bottom bar for the four most frequent destinations plus a “More” sheet. Complex pipelines, question editors, scorecards, comparison tables, and admin analytics require a responsive simplified mode and should identify desktop as preferred. Preserve draft work, filters, and scroll position when moving between list and detail.

## 9. Module Inventory

| Module | Purpose / primary users | Core features and screens | Entities / dependencies | Current status | MVP priority / open questions |
| --- | --- | --- | --- | --- | --- |
| Authentication & authorization | Secure access for all | Register candidate/recruiter, login, refresh rotation, logout, current user/profile; role and persisted permission checks | User, RecruiterProfile, Company; JWT/cookies | **Existing backend** | Must. Add password reset/email verification? |
| Candidate profile | Represent skills and preferences | Profile sections, visibility, completion, recruiter/admin search | CandidateProfile, User, Document | **Existing backend** | Must. Confirm which fields block application. |
| Resume & documents | Private evidence and workflow attachments | Resume/photo/logo, application/assessment/interview/offer documents, verification, signed download | Document, upload session, quota/reservation; storage provider | **Existing backend** | Must for resume; simplify other attachments. Retention policy needs owner approval. |
| GitHub & project verification | Validate project evidence | Connection, repository consent, selected projects, verification status | Proposed GitHubConnection/ProjectVerification | Profile project links only; **integration absent** | Could/later. Define OAuth scopes and private repo policy. |
| Job management | Create governed openings | Draft editor, submit, admin review, publish/pause/close/archive, feature | Job, Company | **Existing backend** | Must. Decide whether admin approves every MVP job. |
| Job discovery | Find eligible published work | Search/filter/list/detail; verified active companies only; private salaries hidden | Job, Company | **Existing API**, no UI/saved jobs | Must. Saved jobs later. |
| Applications | Candidate submission and tracking | Eligibility, snapshots, questions, withdraw, offer response, timeline | Application, Job, CandidateProfile, Document | **Existing backend** | Must. Confirm cover-letter policy. |
| Hiring pipeline | Collaborative ATS | Stage changes, notes, rating, tags, assignees, counts, analytics, admin corrections | Application, memberships, permissions | **Existing backend** | Must; use list/columns with accessible alternative. |
| Assessments | Structured skills evaluation | Question bank, draft/publish/clone, assign, autosave/submit, objective grading, manual review, result release | Assessment, Question, Assignment, Attempt, Document | **Existing backend** | Should/MVP subset. Coding execution unavailable. Proctoring decision required. |
| Interviews | Structured scheduling/evaluation | Templates/rounds, availability, conflict checks, candidate response, scorecards, feedback release, calendar/analytics | Process, Round, Schedule, Feedback, Availability | **Existing backend** | Should. External calendar/video absent. |
| Messaging & notifications | Timely workflow communication | Personal inbox, read/archive, preferences, persisted outbox, templates, optional email, reminders | Notification, Preference, Outbox, Template, EmailLog | Notifications **existing**; user-to-user messaging **absent** | Notifications must; chat not now. |
| AI matching | Assist relevance assessment | Explainable match and recruiter review | Future AIAnalysis; application/job/profile snapshots | **Not implemented**; deterministic skill scoring exists | Later. Never auto-reject. |
| AI project analysis | Summarize consented evidence | Repository/project summary and evidence citations | Future GitHubConnection, Project, AIAnalysis | **Not implemented** | Experimental. Private code handling decision required. |
| Analytics/reporting | Support operational decisions | Job/application, assessment, interview, offer analytics; admin aggregate reports/export | Domain models; UTC utilities | Domain and admin analytics **existing backend**; no candidate/owner dashboard UI | Should. Define metric owners and cohorts. |
| Organization management | Tenant profile and access | Create one company, profile, public discovery, member add/update/remove | Company, RecruiterProfile, permissions | **Existing backend** | Must. Invitation/ownership transfer unclear. |
| Company verification | Establish employer trust | Pending queue, verify/reject/suspend | Company, admin | **Existing backend** | Must. Add “needs information” only after decision. |
| Platform administration | Governance and correction | Recruiter/company/job review, domain corrections, notification ops, analytics | All major modules | **Existing backend**, fragmented by domain | Must at minimum for required approvals. |
| Audit logs | Accountability | Searchable actor/action/object/change log | Proposed AuditLog; domain histories/audit arrays | **Partial only**; centralized model absent | Should later; admin corrections must retain reason meanwhile. |
| Settings | Preferences and controls | Account profile, notification preferences, privacy; organization settings later | User, CandidateProfile, NotificationPreference, Company | **Partial backend** | Must for core preferences. Account deletion/export undecided. |

### Authentication and authorization

- **Purpose:** establish identity, sessions, role gates, and tenant-scoped authority.
- **Primary users:** all users.
- **Core features:** candidate/recruiter registration, login, refresh rotation, logout, current-user retrieval, account-profile edit, role and permission checks.
- **Main screens:** register, login, session expired, account profile, access denied.
- **Important entities:** User, CandidateProfile, RecruiterProfile, Company membership.
- **Permissions:** top-level roles; recruiter permissions reloaded with active approval, membership, and company state.
- **Dependencies:** MongoDB, JWT access/refresh secrets, HTTP-only refresh cookie.
- **Current implementation status:** **Existing backend**; password reset, MFA, and explicit email-verification flow are not evidenced.
- **MVP priority:** Must-have.
- **Open questions:** password recovery, verification, admin provisioning, MFA, account deletion, and users with multiple contexts.

### Candidate profile

- **Purpose:** represent candidate capability, history, preferences, and discoverability.
- **Primary users:** candidates; authorized recruiters/admins as viewers.
- **Core features:** section CRUD, skills/proficiency/experience, projects, preferences, completion score, visibility, recruiter search.
- **Main screens:** profile overview/editor, completion checklist, recruiter search/profile view.
- **Important entities:** CandidateProfile, User, Document.
- **Permissions:** candidate manages own; recruiter/admin sees only permitted projection and visibility.
- **Dependencies:** authentication, document references, profile-completion utility.
- **Current implementation status:** **Existing backend**; no frontend.
- **MVP priority:** Must-have.
- **Open questions:** mandatory fields, public contact visibility, protected/sensitive fields, and correction/appeal path.

### Resume and documents

- **Purpose:** retain private personal and workflow evidence safely.
- **Primary users:** candidates, permitted hiring members, document verifiers, admins under scoped policies.
- **Core features:** upload/replace/delete, signed download, entity attachments, verification, quarantine/status handling, quota reservation and cleanup.
- **Main screens:** resume manager, workflow attachments, verification queue/detail, document status.
- **Important entities:** Document, FileUploadSession, StorageReservation, UserStorageUsage and workflow entities.
- **Permissions:** owner access plus `documents.view/manage/verify`; entity and company permissions also apply.
- **Dependencies:** transaction-capable MongoDB and configured storage provider; optional notifications.
- **Current implementation status:** **Existing backend**; no OCR, actual malware engine, or PDF generation.
- **MVP priority:** Resume must-have; advanced workflow attachments should-have.
- **Open questions:** production retention, evidence verification criteria, user export/deletion, and provider-disabled UX.

### GitHub and project verification

- **Purpose:** let candidates present project evidence with consented provenance.
- **Primary users:** candidates and authorized evaluators.
- **Core features:** proposed OAuth connection, repository selection, evidence review, revocation, and verification provenance.
- **Main screens:** connected accounts, repository selector, project evidence detail.
- **Important entities:** currently embedded project and GitHub URL; proposed GitHubConnection, Project, Verification.
- **Permissions:** candidate controls connection/repositories; recruiter sees explicitly shared output; admin only for governed review.
- **Dependencies:** GitHub OAuth/API, consent, token security, rate limits, retention policy.
- **Current implementation status:** **Not implemented** beyond URLs in candidate profile.
- **MVP priority:** Not-now/could-have only as links.
- **Open questions:** scopes, private repositories, collaborator attribution, refresh, deletion, and use in ranking.

### Job management

- **Purpose:** create and govern organization openings.
- **Primary users:** hiring members, owners, platform admins.
- **Core features:** draft CRUD, skills/weights, questions, eligibility, review, publish/pause/close/archive, feature.
- **Main screens:** managed list, job editor/preview, review status, admin pending queue.
- **Important entities:** Job, Company, User.
- **Permissions:** `jobs.create/update/delete/publish`; admin approves/rejects/features.
- **Dependencies:** approved recruiter, active membership, verified active company for operational/public states.
- **Current implementation status:** **Existing backend**.
- **MVP priority:** Must-have.
- **Open questions:** admin review permanence, clone/template behavior, ownership of closing, and active-candidate closure policy.

### Job discovery

- **Purpose:** help candidates identify eligible published roles.
- **Primary users:** public visitors and candidates.
- **Core features:** public list/detail, text and structured filters, verified-company gating, salary privacy, expiry filtering.
- **Main screens:** search/results, job detail, company detail.
- **Important entities:** Job, Company.
- **Permissions:** public safe projection; apply requires candidate authentication.
- **Dependencies:** job lifecycle and company verification.
- **Current implementation status:** **Existing API**; no frontend, bookmarking, recommendations, or saved alerts.
- **MVP priority:** Must-have.
- **Open questions:** ranking order, SEO, anonymous analytics, saved jobs, and geographic taxonomy.

### Applications

- **Purpose:** create an accountable candidate-to-job submission.
- **Primary users:** candidates, hiring teams, admins.
- **Core features:** eligibility, questions, unique application, detached snapshots, own list/detail, withdrawal, offer response, safe timeline.
- **Main screens:** application review/submit, own list/detail, admin inspection.
- **Important entities:** Application, Job, CandidateProfile, Document, Counter.
- **Permissions:** candidate own; hiring `applications.view/manage`; admin corrections.
- **Dependencies:** published job, profile/resume thresholds, transactions and notifications.
- **Current implementation status:** **Existing backend**.
- **MVP priority:** Must-have.
- **Open questions:** draft applications, application edits, bulk import/manual source, withdrawal messaging, and deletion/retention.

### Hiring pipeline

- **Purpose:** coordinate application review and valid stage progression.
- **Primary users:** hiring teams and admins; candidates receive safe status views.
- **Core features:** stage transitions, history, notes, ratings, tags, assignees, counts, job analytics and corrective overrides.
- **Main screens:** pipeline/list, application detail, activity timeline, admin correction.
- **Important entities:** Application and assessment/interview/offer workflow entities.
- **Permissions:** `applications.view/manage`; admin correction with reason.
- **Dependencies:** memberships, notifications, and downstream module state machines.
- **Current implementation status:** **Existing backend**.
- **MVP priority:** Must-have.
- **Open questions:** configurable stages, bulk transitions, service targets, candidate-visible reasons, and stale concurrent updates.

### Assessments

- **Purpose:** collect structured evidence of skills.
- **Primary users:** assessment designers/reviewers and assigned candidates.
- **Core features:** question bank, draft/publish/clone, immutable assignment snapshot, availability/expiry, autosave, objective grade, manual review, result release and attachments.
- **Main screens:** library/editor, assignment queue, candidate attempt/result, reviewer queue/statistics.
- **Important entities:** Question, Assessment, AssessmentAssignment, AssessmentAttempt, Document.
- **Permissions:** `assessments.view/manage/assign/review`; candidate ownership; admin correction.
- **Dependencies:** eligible application, server time, workflow notifications, isolated runner if coding is later enabled.
- **Current implementation status:** **Existing backend**; code execution unavailable by default and subjective answers require review.
- **MVP priority:** Should-have with objective subset.
- **Open questions:** accommodations, proctoring, retakes, pass thresholds, result policy, plagiarism, and question governance.

### Interviews

- **Purpose:** schedule and evaluate consistent multi-round interviews.
- **Primary users:** candidates, schedulers, interviewers/evaluators, admins.
- **Core features:** templates, processes/rounds, availability, conflict-safe scheduling, candidate response, reschedule/cancel/no-show, scorecards, feedback release, calendar/analytics.
- **Main screens:** templates, process detail, calendar, candidate schedule, scorecard, analytics.
- **Important entities:** InterviewTemplate, Process, Round, Schedule, Availability, Feedback.
- **Permissions:** `interviews.view/manage/schedule/evaluate`; candidate own; admin corrections.
- **Dependencies:** application stage, active approved team, UTC/IANA time zones, external meeting metadata.
- **Current implementation status:** **Existing backend**; no video or calendar provider integration.
- **MVP priority:** Should-have.
- **Open questions:** calendar sync, reminder policy, cancellation windows, feedback visibility, and evaluator conflicts of interest.

### Messaging and notifications

- **Purpose:** deliver durable workflow and security communication.
- **Primary users:** all authenticated users; admins operate templates/outbox.
- **Core features:** own inbox, unread count, read/archive/batches, preferences, templates, delayed reminders, retry/cancel and optional email.
- **Main screens:** notification center/preferences and admin outbox/template/log operations.
- **Important entities:** Notification, NotificationPreference, NotificationOutbox, NotificationTemplate, EmailLog.
- **Permissions:** own inbox only; admin operations; no public creation endpoint.
- **Dependencies:** allowlisted service events, optional Resend/console provider, frontend-safe action URLs.
- **Current implementation status:** Notifications **existing backend**; interpersonal messaging **not implemented**.
- **MVP priority:** In-app must-have; email should-have; chat not-now.
- **Open questions:** invitation delivery, retention, digest UI, real-time transport, support messaging, and mandatory-event list.

### AI matching

- **Purpose:** assist candidate-job comparison without replacing human judgment.
- **Primary users:** candidates and hiring teams.
- **Core features:** proposed cited factor analysis, missing-evidence explanation, confidence and human override.
- **Main screens:** match explanation and candidate comparison disclosure.
- **Important entities:** existing snapshots/skill breakdown; proposed AIAnalysis.
- **Permissions:** candidate sees safe personal explanation; hiring team only within company/application scope.
- **Dependencies:** AI governance, consent, evaluation set, provider and privacy policy.
- **Current implementation status:** **Not implemented**; deterministic scoring exists.
- **MVP priority:** Later.
- **Open questions:** visibility, bias testing, lawful basis, override recording, appeal, model updates, and whether ranking is allowed.

### AI project analysis

- **Purpose:** summarize explicitly shared project evidence.
- **Primary users:** candidates and technical evaluators.
- **Core features:** proposed evidence extraction, citations, claim review, versioning and revocation.
- **Main screens:** project analysis preview and evaluator evidence view.
- **Important entities:** proposed Project, GitHubConnection, Verification, AIAnalysis.
- **Permissions:** candidate opt-in; authorized application reviewers only.
- **Dependencies:** repository/file access policy, secret scanning, provider contract, attribution and retention.
- **Current implementation status:** **Not implemented**.
- **MVP priority:** Experimental/post-MVP.
- **Open questions:** code/IP access, team attribution, private repositories, prompt injection, freshness, and appeals.

### Analytics and reporting

- **Purpose:** reveal workflow performance and safe platform health.
- **Primary users:** hiring teams, owners and platform admins; limited candidate self-insight later.
- **Core features:** module analytics, UTC ranges/time series/funnels, safe platform reports, bounded JSON/CSV export.
- **Main screens:** job/pipeline, assessment, interview, offer, owner and admin dashboards.
- **Important entities:** aggregate reads from all main domain models.
- **Permissions:** module permissions; platform analytics restricted to active admin.
- **Dependencies:** metric catalog, privacy thresholds, accurate status histories and indexes.
- **Current implementation status:** **Existing backend** for recruiter module analytics and admin aggregate analytics; no frontend.
- **MVP priority:** Simple operational views should-have; advanced reports later.
- **Open questions:** candidate analytics, owner scope, small cohorts, source attribution, saved reports, and refresh expectations.

### Organization management

- **Purpose:** manage tenant identity, membership and permissions.
- **Primary users:** owner and permissioned hiring members; public sees safe verified profile.
- **Core features:** create one active company, edit profile, list/detail, add/update/remove team members.
- **Main screens:** company setup/profile, team and permissions, public company page.
- **Important entities:** Company, RecruiterProfile, User.
- **Permissions:** `company.manage`, `team.manage`; owner receives all current recruiter permissions.
- **Dependencies:** recruiter approval and company verification.
- **Current implementation status:** **Existing backend**; dedicated invitation acceptance and multi-company membership are not evidenced.
- **MVP priority:** Must-have.
- **Open questions:** owner transfer, last-owner protection, invitation lifecycle, multi-company support and billing owner.

### Company verification

- **Purpose:** ensure only trusted active companies operate public hiring.
- **Primary users:** company owner/team and platform administrators.
- **Core features:** pending state, admin queue, verify/reject/suspend, public verified-only projection.
- **Main screens:** owner verification status, admin queue/detail/decision.
- **Important entities:** Company and verification fields; Documents may support evidence workflows.
- **Permissions:** admin decides; team sees appropriate status and supplies evidence under future policy.
- **Dependencies:** organization onboarding, document rules, notification policy.
- **Current implementation status:** **Existing backend** with pending/verified/rejected/suspended; needs-information absent.
- **MVP priority:** Must-have if admin publication trust remains.
- **Open questions:** evidence list, SLA, resubmission, expiry/reverification, appeal and suspension effects.

### Platform administration

- **Purpose:** govern users, companies, jobs and exceptional workflow states.
- **Primary users:** Talvix administrators.
- **Core features:** recruiter/company/job queues, domain inspection/correction, note moderation, document and notification operations, analytics/health.
- **Main screens:** admin overview, queues, domain detail, operations and reports.
- **Important entities:** all major domain entities.
- **Permissions:** active `admin` role; least privilege within admin is not currently modeled.
- **Dependencies:** safe admin serializers, reasoned corrections, audit logging and support policy.
- **Current implementation status:** **Existing backend**, but capabilities are domain-specific rather than a complete case-management console.
- **MVP priority:** Must-have minimum queues required by recruiter/company/job workflows.
- **Open questions:** admin subroles, candidate suspension, appeals, support impersonation prohibition, case management and approval separation.

### Audit logs

- **Purpose:** provide centralized accountability for security and consequential actions.
- **Primary users:** authorized platform security/support and, for tenant events, owners under policy.
- **Core features:** proposed append-only actor/action/object/result/reason history, search, retention and safe export.
- **Main screens:** audit search/detail and entity activity link.
- **Important entities:** proposed AuditLog; current domain status histories/audit arrays.
- **Permissions:** tightly scoped admin; tenant-owner view only for own organization-safe events.
- **Dependencies:** event taxonomy, redaction, immutable storage, clock/retention/export policy.
- **Current implementation status:** **Partial**; no centralized model or API.
- **MVP priority:** Record high-risk actions should-have; full UI post-MVP.
- **Open questions:** viewer roles, retention, IP/device data, before/after storage, export audit, and legal access.

### Settings

- **Purpose:** let users and organizations control preferences, privacy and account behavior.
- **Primary users:** all users; owners for organization settings.
- **Core features:** current user/profile edit, candidate visibility, notification preferences; proposed security sessions, data rights and organization defaults.
- **Main screens:** account, privacy, notifications, security, organization settings and future billing.
- **Important entities:** User, role profiles, NotificationPreference, Company.
- **Permissions:** own settings; owner/`company.manage` for tenant settings.
- **Dependencies:** authentication, privacy/retention and billing decisions.
- **Current implementation status:** **Partial backend**.
- **MVP priority:** Core account/privacy/notifications must-have.
- **Open questions:** password change/reset, MFA, sessions, locale/timezone, export/deletion, default workflow policy and billing.

## 10. Core User Journeys

The journeys below identify the intended product flow. A step marked “future” has no complete repository implementation.

### Candidate journeys

| Journey | Trigger / preconditions | Steps | Success state | Failure states | Notifications |
| --- | --- | --- | --- | --- | --- |
| Registration & onboarding | Visitor; unique email | Choose candidate → register → session starts → profile record created → complete essentials → set visibility | Active candidate with usable profile | Duplicate email, validation, transaction/profile failure, inactive account | Welcome event/inbox; email if enabled |
| Complete profile | Signed-in candidate | Add headline/contact/location → education → skills/proficiency/experience → experience/projects/certifications → preferences → review completion | Saved profile and completion score | Invalid dates/URLs, save conflict, weak network | Optional completion nudges are recommended, not existing |
| Connect GitHub | Signed in; informed consent | Explain scopes → OAuth → choose repositories → review imported evidence → revoke | Consented connection and selected evidence | OAuth denial, rate limit, private repo restriction | Security connection/revocation recommended; **future** |
| Upload resume | Profile exists; uploads enabled/quota | Select safe file → validate → reserve quota → private upload → link current resume | Current resume document linked | Type/signature/size/quota/provider/transaction failure; cleanup initiated | Document decision events when relevant |
| Discover job | Public or signed in | Search/filter → inspect verified company/job → review requirements/salary visibility/deadline | Suitable job identified | No results, expired/unpublished job, load error | Saved-search alert is future |
| Apply | Candidate; published unexpired job; thresholds met | Review profile/resume → answer questions → consent → submit → immutable snapshots and match stored | Unique submitted application number | Incomplete profile, resume missing, duplicate, blocked profile, transaction conflict | Candidate and authorized recruiters notified |
| Complete assessment | Assigned and available | Open instructions → start → answer/autosave/upload allowed evidence → submit or server expiry → await/review result | Submitted/completed; permitted result shown after release | Too early/expired/cancelled, save failure, unsupported code evaluation | Assignment, 24h/1h reminders, completion as configured |
| Attend interview | Proposed schedule | Review safe details → accept/request change → attend externally → track round status | Confirmed/completed process | Conflict, expired response window, cancellation, no-show, missing meeting access | Scheduled/rescheduled/reminders/cancel changes |
| Track application | Own application exists | Open list → filter → view current stage and privacy-limited history → refresh early snapshot if eligible | Understand current state and next action | Removed job must not erase snapshot; unauthorized access; stale transition | Stage and module-specific events |
| Offer response | Visible current revision | Review terms/attachments → ask negotiation or accept/decline → confirm action | Recorded response; accepted can later become hired | Expired/superseded/withdrawn offer, conflict, validation | Sent/revised/reminders; response notifies responsible team |

### Hiring-team journeys

| Journey | Trigger / preconditions | Steps | Success state | Failure states | Notifications |
| --- | --- | --- | --- | --- | --- |
| Organization onboarding | Approved recruiter; no active company | Create company → owner membership/all permissions created → submit evidence as applicable → await admin verification | Verified active workspace | Recruiter unapproved, duplicate company, rejection/suspension | Verification updates |
| Create/publish job | Verified active company; job permissions | Create draft → complete role/skills/eligibility → preview → submit review → admin approves → publish | Public discoverable job | Incomplete draft, permission denied, rejection, expired deadline | Review outcome; publication event policy to confirm |
| Review/filter applicants | Application view permission | Select job/view → filter status/skill match/tags/assignee → open evidence → rate/tag/note | Prioritized, documented queue | Private profile/evidence denied, stale filter, cross-tenant attempt | Assignment/stage events as relevant |
| View AI match reasoning | AI later; consent/policy configured | Open candidate comparison → inspect factors/evidence/confidence → correct/ignore → record human rationale | Human-informed decision | AI unavailable/bias/unsupported evidence | Usually none; display deterministic score now |
| Move through pipeline | Manage permission; valid current stage | Select candidate → choose allowed next stage → enter reason where required → confirm → append history | Valid audited transition | Invalid/stale/terminal stage, missing dependency, permission denied | Generic stage event except module-specific suppression |
| Create/assign assessment | Manage/assign permissions | Build/clone → add questions → publish/freeze → choose application/window → assign snapshot | Candidate receives immutable assignment | Invalid application stage, unpublished/incomplete test, duplicate/expired window | Assigned plus reminders |
| Schedule interview | Schedule permission; process/template exists | Create process → select round/interviewers/timezone/mode → conflict/availability check → propose | Candidate/interviewers receive versioned schedule | Availability conflict, invalid member, wrong duration/provider metadata | Scheduled/rescheduled plus reminders |
| Submit scorecard | Assigned evaluator; evaluate permission | Start round → score criteria → notes/recommendation → review → submit immutable feedback | Feedback included in round result | Missing required criteria, late/duplicate submit, reopened state | Completion/review follow-up as configured |
| Create offer | Eligible application; manage permission | Draft from snapshot/template → terms → request approval → approver accepts → sender sends | Candidate sees exact revision | Existing active offer, invalid stage, rejected approval, expiry | Sent/revised/reminders/response |
| Close job | Manage permission; valid published/paused state | Review open candidates → choose close → communicate outcome policy → close → archive later | No new applications; history retained | Active workflow handling unclear; invalid transition | Candidate closure/rejection policy **Decision required** |

### Platform-admin journeys

| Journey | Trigger / preconditions | Steps | Success state | Failure states | Notifications |
| --- | --- | --- | --- | --- | --- |
| Company verification | Pending company; admin | Inspect safe company data/evidence → verify or reject with notes → persist actor/time | Correct verification state | Insufficient information state absent, conflict, evidence unavailable | Company/team update |
| Reported content | User report | Triage → inspect minimum necessary context → decide → act/close → audit | Proportionate resolution | Reporting/case system absent; false report; privacy boundary | Reporter/subject policy **future/decision** |
| Suspend fraud account | Credible evidence; admin | Verify identity/risk → select scoped suspension → reason/confirm → invalidate access → retain appeal data | Access restricted and action traceable | General user suspension/appeal not fully implemented | Mandatory security event recommended |
| Review audit history | Support/governance need | Search actor/object/time → inspect transition history → export permitted record | Question answered with minimal exposure | Central audit log absent; fragmented histories | None |
| Platform health/analytics | Active admin | Select UTC range/report → inspect conversion/backlog/health → export bounded aggregate | Actionable operational insight | Bad range, zero denominator, source lag, export error | Operational alerts are future |

## 11. Screen Inventory

All screens are **planned frontend screens** unless marked public API/backend. Standard behavior: skeleton or progress indication while loading; actionable inline error with retry; empty state explains why and offers a permitted next action. `D` means full desktop, `R` responsive mobile, `P` desktop preferred.

| Group / screen | Purpose; primary / secondary actions | Required data | Empty / loading / error specifics | Permission | Device |
| --- | --- | --- | --- | --- | --- |
| Public: Home | Explain product; browse jobs / companies | Curated copy, counts only if reliable | Helpful discovery CTA; avoid fake metrics | Public | R |
| Public: Job search | Find jobs; filter/sort / clear/save later | Published jobs, facets, pagination | Suggest broaden filters | Public | R |
| Public: Job detail | Evaluate role; apply / company view | Safe job/company projection | Expired/closed state, salary privacy | Public; apply candidate | R |
| Public: Company directory/detail | Establish employer context; browse jobs | Verified active companies | Verification-safe not-found | Public | R |
| Auth: Register/login | Create/access account; switch flow | Validated inputs, session | Preserve non-secret fields; generic credential error | Public | R |
| Auth: Session expired | Recover context; sign in | Redirect target, unsaved draft marker | Clear security message | Shared | R |
| Candidate: Dashboard | Prioritize actions; resume workflow | Completion, active items, deadlines, unread | Guided onboarding | Candidate own | R |
| Candidate: Profile editor | Manage identity/evidence; add/edit sections | CandidateProfile | Section skeleton; field errors; autosave state | Candidate own | R |
| Candidate: Documents/resume | Upload/replace/delete; inspect status | Safe document metadata/quota | Explain provider disabled/quarantine | Candidate own | R |
| Candidate: Applications list/detail | Track stages; withdraw/refresh snapshot | Own application safe projection/history | First-application CTA; stale/terminal states | Candidate own | R |
| Candidate: Assessment list/attempt/result | Complete assigned work; save/submit | Safe question snapshot, server time, result release | Persistent save status; expiry recovery | Candidate assignment owner | P/R attempt |
| Candidate: Interviews/availability | Respond and prepare; request reschedule | Safe process/schedule/availability | Timezone and cancelled/no-show states | Candidate owner | R |
| Candidate: Offers | Review revision; accept/decline/negotiate | Safe offer/attachments/timing | Expired/superseded clarity | Candidate owner | P/R |
| Hiring: Overview | Surface work queues | Jobs, pipeline, reviews, interviews, offers | Setup/verification gate | Recruiter + scoped data | P/R |
| Hiring: Job list/editor/detail | Draft and manage jobs | Job/company/status | Draft recovery; review rejection | Job permissions | P |
| Hiring: Candidate search | Discover visible candidates | Safe profiles, filters | Privacy-aware no results | Recruiter/admin | P |
| Hiring: Application pipeline | Review/move candidates | Applications, stages, counts | Accessible list alternative; conflict refresh | Application permissions | P |
| Hiring: Application detail | Inspect evidence/collaborate | Snapshots, documents, notes, history | Redacted/retained evidence states | Application/document permissions | P |
| Hiring: Assessment library/editor | Build evaluations | Questions, assessments, attachment rules | Published immutable warning | Assessment permissions | P |
| Hiring: Assignment/review | Assign, score, release | Assignment/attempt safe reviewer data | Manual-review queue; code unavailable | Assign/review permissions | P |
| Hiring: Interview templates/process/calendar | Schedule structured rounds | Templates, members, availability, schedules | Conflict and timezone guidance | Interview permissions | P |
| Hiring: Scorecard | Evaluate candidate | Criteria snapshot, round context | Draft/submitted/reopened states | Evaluate permission + assignment | P/R |
| Hiring: Offer list/editor/approval | Draft/approve/send/revise | Offer/template/application snapshots | Confidential terms and stale status | Offer permissions | P |
| Owner: Company profile/verification | Manage employer identity | Company and safe verification state | Pending/rejected/suspended guidance | Company manage | P/R |
| Owner: Team/permissions | Add/remove and scope access | Active approved recruiters, membership | Protect last owner; invitation ambiguity | Team manage | P |
| Owner: Billing | Subscription controls | Future plan/invoices | Not available | Decision required | P/R |
| Admin: Overview/analytics/health | Govern and monitor | Aggregate reports and safe health | UTC/zero-data context | Active admin | P |
| Admin: Recruiter/company/job queues | Review and decide | Pending entities, evidence, reasons | Conflict/resolved state | Admin | P |
| Admin: Domain oversight | Inspect/correct workflows | Admin projections and histories | Mandatory reason, high-friction confirm | Admin | P |
| Admin: Documents | Review metadata/status | Safe metadata; no raw bypass | Quarantine wording reflects scan state | Admin/domain policies | P |
| Admin: Notifications operations | Inspect outbox/templates/masked logs | Notification ops data | Retry/cancel eligibility | Admin | P |
| Admin: Audit log | Cross-domain traceability | Future AuditLog | Explain unavailable until built | Admin | P |
| Shared: Notification inbox/preferences | Act on updates; read/archive/configure | Own notifications/preferences | Unread zero state; mandatory security lock | Authenticated own | R |
| Shared: Account/privacy/security | Manage identity and controls | User/session/privacy data | Export/deletion pending decisions | Authenticated own | R |
| System: 403/404/409/429/5xx/offline | Recover safely | Correlation-safe error details | Retry/back/navigation, never expose secrets | Contextual | R |

## 12. Data and Domain Model

### Implemented entities

| Entity | Purpose and relationships | Ownership/lifecycle | Sensitive fields and retention |
| --- | --- | --- | --- |
| User | Identity with candidate/recruiter/admin role; one role profile | Platform identity; active/inactive | Password/hash, refresh token, email, login activity; deletion policy undecided |
| CandidateProfile | Skills, experience, education, projects, preferences; belongs to User | Candidate-owned; visibility controls recruiter discovery | Phone, DOB, gender, salary expectations, location; minimize and support consent |
| RecruiterProfile | Recruiter approval, company link, permissions, owner flag | User-owned/platform-approved | Phone, approval actors, permissions |
| Company | Tenant, public employer profile, owner, embedded team memberships | Owner-managed; admin verified/rejected/suspended | Verification notes/actor, contacts; retain governance history |
| Job | Company opening with skills, eligibility, questions and lifecycle | Company-created; admin-reviewed; public only when eligible | Private salary, reviewer data; retain snapshots through applications |
| Application | Candidate-job relationship, immutable snapshots, skill score, stages, notes | Candidate submits; company manages; admin corrects | Resume/profile snapshot, answers, notes, ratings, rejection reasons; retain for hiring/legal policy |
| Question / Assessment | Company question bank and assessment definition | Company; published assessment freezes | Correct answers, explanations, hidden tests must never reach candidate projection |
| AssessmentAssignment / Attempt | Immutable assigned evaluation and candidate responses/results | Company assignment; candidate attempt; reviewer/admin governance | Answers, code, IP/user-agent/integrity signals, grading data; define retention and appeal access |
| InterviewTemplate / Process / Round | Frozen structured interview workflow | Company and application scoped | Instructions, private feedback/security details |
| InterviewSchedule / Availability / Feedback | Timing, participants, scorecards | Participant/company scoped | Meeting links, availability, private notes/concerns; retain submitted scorecards and revisions |
| OfferTemplate / Offer | Terms, approval, immutable revisions and response | Company/application/candidate scoped | Compensation, terms, approval actors, candidate snapshots; revision chain retained |
| Document | Private file metadata and links to profile/workflow entities | Owner/company/entity derived server-side | Provider IDs, checksums, signed URLs, scan/verification notes; retained-reference cleanup required |
| FileUploadSession / StorageReservation / UserStorageUsage | Safe uploads and distributed quota accounting | Server-managed | Provider metadata and quota; expire or reconcile safely |
| Notification / Preference / Outbox / Template / EmailLog | Personal notifications and delivery operations | Recipient-owned; platform templates/ops | Body/data, provider IDs/errors; masked admin logs and bounded retention needed |
| Counter | Atomic application/offer numbering | Platform-managed | Low sensitivity; consistency critical |

### Proposed entities, not implemented

| Entity | Purpose / relationship | Product requirements |
| --- | --- | --- |
| OrganizationMembership (separate collection) | Scalable user↔organization membership replacing/augmenting embedded team members | Role preset, granular permissions, invitation lifecycle, tenant indexes, ownership transfer |
| Role / Permission preset | Named organization roles over existing permission strings | Presets versioned; persisted permissions remain authoritative |
| Resume (logical) | Versioned resume domain concept over Document | Consent, active version, application snapshot retention |
| Project | First-class evidence beyond embedded profile project | Candidate ownership, visibility, verification provenance |
| GitHubConnection | OAuth grant and selected repository metadata | Least scope, revocation, refresh/error status, no token exposure |
| Verification | Generic company/project/identity verification case | Evidence, decision, appeal, expiry, reviewer separation |
| Message / Conversation | Optional candidate–team communication | Tenant/application scope, blocking/reporting, retention; not MVP |
| ActivityLog | User-facing benign activity feed | Safe summaries; never substitute for security audit |
| AuditLog | Append-only governance trail | Actor, tenant, action, object, reason, before/after-safe fields, request context, retention |
| AIAnalysis | Versioned assistive output linked to source snapshots | Purpose, model/config version, evidence citations, confidence, human disposition, consent and deletion |

Relationships center on `User → role profile`; `Company → jobs/team`; `Job → applications`; and `Application → assessment, interview, offer, documents, notifications`. Consequential workflows retain detached snapshots so later profile/job/template edits do not rewrite history.

## 13. Status and Lifecycle Definitions

Repository statuses take precedence over simplified labels suggested in the brief.

### Application

`submitted → under-review → shortlisted → assessment-pending → assessment-in-progress → assessment-completed → shortlisted or interview-scheduled → interview-completed → offer-pending → offer-sent → offer-accepted → hired`. Eligible nonterminal states may become `rejected`; candidate may become `withdrawn`; `offer-sent` may become `offer-declined`.

- Candidate: submit, withdraw from allowed nonterminal states, accept/decline offer.
- Hiring team: valid pipeline transitions with `applications.manage`.
- Assessment/interview/offer services: authoritative module transitions.
- Admin: reason-required corrective transition marked override.
- Terminal or effectively irreversible: hired, rejected, withdrawn, offer-declined except explicit admin correction. Every transition requires status history; module-specific notifications suppress duplicate generic events.

### Job

`draft → pending-review → published ↔ paused → closed → archived`; admin may send `pending-review → rejected → draft`.

- Recruiter creates/edits draft and performs permission-scoped lifecycle actions.
- Admin approves/rejects pending review and may feature/unfeature.
- Published discovery requires verified active company, unexpired deadline, and published state.
- Archived is terminal in the documented flow; delete applies only under service rules. Review actor/reason/time should be audited.

### Assessment attempt and assignment

The implementation separates assignment (`assigned`, `available`, `in-progress`, `submitted`, `evaluating`, `completed`, `expired`, `cancelled`) from attempt (`not-started`, `in-progress`, `submitted`, `auto-evaluated`, `review-pending`, `completed`, `expired`, `cancelled`).

- System time changes availability/expiry; candidate starts, saves and submits.
- Objective items may auto-evaluate; subjective/coding-unavailable items move to review.
- Reviewer completes scoring and may release result; admin can reopen review/correct assignment state with reason.
- Submitted answers and published snapshots should be immutable. Cancellation/expiry are irreversible except governed admin correction. All integrity and review actions require traceability.

### Organization verification

Implemented: `pending → verified | rejected | suspended`; admin triggers decisions. Public discovery and most company operations require verified and active. `not submitted` and `needs information` are not implemented.

Recommended future flow: `not-submitted → pending → needs-information ↔ pending → verified`; `pending → rejected`; `verified/rejected → suspended` only under policy; appeal/resubmission creates a new decision record rather than erasing history. Notify owner and appropriate active team members; require reason, evidence reference, actor and time.

### Offer and interview note

Offer and interview lifecycles are richer than the brief's examples. Offer revisions, approval, visibility, expiry, and application state must remain synchronized. Interview processes, rounds, schedules, candidate responses, and immutable submitted feedback each have separate state machines; UI must never collapse them into one misleading status.

## 14. AI Capability Map

**Policy:** AI may assist research, drafting, summarization, and comparison. It must not independently reject, shortlist, rank as an undisclosed gate, or make a final hiring decision. Users must see when AI was used, the evidence considered, material limitations, and a human review path.

| Capability / class | Value; inputs → output | Human review / explainability | Risks, privacy, fallback |
| --- | --- | --- | --- |
| Resume extraction — **MVP optional** | Reduce entry; consented resume → editable structured profile | Candidate confirms every field; cite page/section | Sensitive-data inference/OCR error; private processing; manual entry fallback |
| Profile enrichment — **Later** | Suggest missing skills/evidence; profile/resume → suggestions | Candidate opt-in and accepts | Hallucination/stereotyping; never infer protected traits; normal editor fallback |
| Job-description assistance — **MVP optional** | Improve completeness; recruiter draft/policy → suggested copy | Recruiter edits/owns final; flag exclusionary language | Bias/copyright/confidentiality; templates/manual drafting fallback |
| Candidate-job matching — **Later** | Surface relevant applications; consented snapshots → score/factors | Recruiter sees factors; candidate receives understandable basis when consequential | Bias/proxy discrimination/ranking opacity; deterministic skill score/filter fallback |
| Explainable matching — **Required with AI match** | Show evidence and gaps; match inputs → factor breakdown/citations | Human can override and record rationale | False precision; disclose confidence/missing data; raw evidence fallback |
| Project analysis — **Experimental** | Summarize evidence; submitted project/artifacts → claims with citations | Candidate previews; recruiter validates | IP/secrets/fabricated claims; manual project presentation fallback |
| GitHub analysis — **Experimental** | Summarize selected repos; least-scope metadata/code → evidence summary | Explicit repo selection and revocation; cite commits/files | Private code, collaborator attribution, recency bias; link-only/manual evidence fallback |
| Interview-question generation — **Later** | Structured preparation; job/criteria → question suggestions | Interview owner approves; consistent rubric required | Illegal/biased questions; approved library fallback |
| Assessment generation — **Later** | Draft question set; competency blueprint → editable questions/answers | Technical evaluator validates answers/tests/difficulty | Wrong answers, leakage, copyright, unequal difficulty; manual bank fallback |
| Answer evaluation — **Not recommended** for subjective hiring decisions; **Experimental** for assistive rubric hints | Responses/rubric → suggested score and evidence | Reviewer must score; disclose assistance | Bias, prompt injection, language disadvantage; manual review authoritative |
| Candidate summary — **Later** | Reduce review time; authorized snapshots → cited neutral summary | Recruiter validates; candidate correction channel for source facts | Omission and sensitive inference; source views fallback |
| Recruiter copilot — **Experimental** | Query workflow and draft actions; tenant data → suggestions | No consequential action without explicit confirmation | Data leakage/action errors; normal navigation fallback |
| Fraud/plagiarism signals — **Experimental** | Prioritize review; integrity metadata/similarity → risk signal | Trained reviewer; appeal; never automatic rejection | False positives/surveillance; disclose data use; manual integrity review |
| Recommendation ranking — **Not recommended for MVP** | Order opportunities/candidates | Must expose factors, allow non-ranked view and audit | Feedback loops and discrimination; chronological/filter/saved-view fallback |

## 15. Notifications and Communication

| Event | Recipient | Channel / urgency | Disable? |
| --- | --- | --- | --- |
| Application received | Candidate and authorized recruiters | In-app + preferred email; normal | Email/category yes, in-app recommended retained |
| Stage changed | Candidate; relevant team | In-app + preferred email; normal/high for action | Ordinary email yes; suppress duplicates for module events |
| Assessment assigned | Candidate | In-app + email; high | Email preference yes; in-app no while actionable |
| Assessment deadline | Candidate | Delayed 24h/1h in-app + preferred email; high | Ordinary email yes; stale reminders cancelled |
| Interview scheduled/changed | Candidate and interviewers | In-app + preferred email; high | Email yes; in-app no while actionable |
| Offer sent/revised | Candidate | In-app + preferred email; high | Email preference decision; in-app mandatory while active |
| Offer accepted/declined | Offer creator/managers; candidate confirmation | In-app + preferred email; high | Email yes |
| Company verification update | Owner/active relevant team | In-app + email; high | Suspension/security should be mandatory |
| Team invitation/addition | Invitee and owner | Email + in-app if account exists; high | No for invitation/security; workflow details unresolved |
| Account-security event | Affected user | In-app + email; critical | No; repository preferences make security email mandatory |

Optional real-time delivery may update unread counts and active screens, but persisted notifications remain authoritative. There is no user-to-user messaging implementation. For MVP, use contextual comments/private notes inside existing workflows and transactional notifications; do not introduce chat until scope, moderation, blocking, retention, and response expectations are decided.

## 16. Search, Filters, and Saved Views

| Area | Search and filters | Recommended saved views |
| --- | --- | --- |
| Jobs | Text, skill, location, employment type, work mode, experience, company, date, featured; salary only when visible | Candidate alerts later; recruiter “my drafts”, “awaiting review”, “closing soon” |
| Candidates | Text, skills, location, preferred role/type, availability, minimum experience, profile completion/visibility | “Ready for junior backend”, “available now”; consent/privacy enforced |
| Applications | Job, stage, skill score, tag, rating, assignee, source, submitted date, age in stage | “Unassigned new”, “assessment overdue”, “interviews this week”, “offers expiring” |
| Assessments | Name/type/status/job, creator, assignment status, review state, expiry | “Needs manual review”, “expiring today”, “unreleased results” |
| Interviews | Candidate/job/process/round/status, interviewer, date range, mode, missing feedback | “My interviews”, “awaiting feedback”, “reschedule requests” |
| Organizations | Name, industry, size, location, verification | Admin “pending longest”, “suspended”; public verified only |
| Users/recruiters | Name/email where authorized, role, active/approval/company state | Admin “pending recruiters”; never broad candidate export by default |
| Audit logs | Actor, tenant, action, object type/id, result, UTC range, reason | “High-risk actions”, “admin overrides”, “permission changes”; **future** |

Saved hiring views should store filters, sort, visible columns, layout, ownership, and optional team sharing. They must not bypass current permissions when reopened.

## 17. Analytics Requirements

| Audience | Decision-oriented metrics |
| --- | --- |
| Candidate | Profile completion and missing actionable sections; applications by current stage; response/deadline completion; assessment/interview activity. Avoid comparative “candidate quality” or vanity profile views. |
| Recruiter/team | New and unreviewed applications, stage conversion ever reached, time in stage, aging/SLA, assessment completion/review time/pass rate by valid cohort, interview completion/feedback latency/pass recommendations, offer acceptance, source-to-qualified/hire. |
| Organization owner | Time to first review, time to hire, application-to-hire conversion, job performance, bottlenecks, workload distribution, team feedback timeliness, verification outcomes, source quality and structured-process adoption. |
| Platform admin | Verified supply, active published jobs, application and hire funnels, recruiter/company approval outcomes, document failure/quarantine/cleanup state, outbox backlog/failures, safe runtime health, aggregate growth and bounded exports. |

Definitions must specify UTC range, cohort, numerator, denominator, exclusions, and refresh time. Funnel counts mean stages ever reached, matching current analytics behavior; current status is separate. Suppress or coarsen small cohorts where re-identification is plausible. Do not expose protected traits, private notes, assessment answers, salary, offer terms, file URLs, or provider identifiers in exports.

## 18. UX Rules and Product Behavior

- **Empty states:** distinguish first use, no search results, no permission, disabled provider, and completed work. Offer one permitted next step.
- **Loading:** skeleton lists/details; determinate progress for uploads; persistent autosave status for assessments and long forms. Never imply success before transaction completion.
- **Errors:** preserve safe input, identify field vs system error, provide retry, and use a correlation reference without stack/configuration exposure.
- **Confirmations:** inline confirmation for reversible actions; high-friction modal with consequence and required reason for reject, withdraw, close, suspend, delete, cancel, and irreversible submit.
- **Destructive actions:** identify affected entity/state; block invalid actions; prefer archive/replace; do not cascade-delete retained hiring evidence.
- **Autosave/drafts:** assessment answers and long editors show Saving/Saved/Failed and server timestamp. Job, assessment, interview template, scorecard, and offer drafts require explicit lifecycle states.
- **Unsaved changes:** warn on navigation, session expiry, or tab close; restore only non-sensitive drafts safely.
- **Permission denied:** explain unavailable action without revealing hidden entity existence; suggest workspace owner only where safe.
- **Expired sessions:** preserve navigation intent and non-secret local state, reauthenticate, then revalidate permissions and server state.
- **Weak network/offline:** read-only cached summaries may be labeled stale; queueing consequential actions offline is not recommended. Assessment answers may retry with version conflict handling and visible last-server-save time.
- **Mobile:** all candidate tasks must work responsively. Complex admin/building tools may be desktop-preferred but must support critical review/response actions.
- **Accessibility:** WCAG 2.2 AA target, semantic headings/labels, non-color status indicators, 44px touch targets, sufficient contrast, error summary, captions/transcripts policy for media, and accessible time-zone/date controls.
- **Keyboard:** full navigation, visible focus, skip links, dialogs with focus management, table/list alternatives to drag-and-drop Kanban, shortcuts documented and optional.
- **Reduced motion:** honor system preference; no essential information conveyed through animation.

## 19. Security, Privacy, and Trust Requirements

1. Reload active user, recruiter approval, active membership, company verification/active state, and permissions from the database; never trust authorization claims in JWTs.
2. Scope every organization object server-side and avoid existence leaks across tenants.
3. Obtain explicit candidate consent for application snapshots, resume sharing, GitHub scopes, AI processing, and optional talent discovery.
4. Default candidate visibility to recruiters-only, as currently modeled; clearly show who can access each field/document.
5. Keep resumes and workflow documents private, use short-lived delivery, enforce quotas/type/signature rules, and never expose provider IDs/checksums/signed URLs in events/logs.
6. Preserve retained references before provider deletion; quarantine language must not claim scanning that did not occur.
7. Add a centralized append-only audit log for authentication security, permission/owner changes, verification, admin overrides, exports, sensitive document access, and AI-assisted consequential actions.
8. Provide scoped data export and account deletion workflows only after retention/legal dependencies are defined. Deletion must not silently erase required application/offer/audit evidence.
9. Define organization verification evidence, reviewer separation, expiry, resubmission, appeal, and suspension rules.
10. Provide anti-fraud controls proportionate to risk: rate limits, duplicate/abuse detection, upload validation, suspicious-event review, and appeals. Do not present metadata as definitive fraud proof.
11. Rate-limit authentication, search, application, assessment save/submit, upload, notification processing, exports, and AI endpoints; exact values are an implementation/security decision.
12. Never execute candidate code in-process. Use an isolated external runner only if later approved.
13. Publish allowlisted, sanitized domain events from services. Optional notification/email failure must not reverse business mutations.
14. Explain AI purpose, source data, retention, provider use, human review, limitations, correction/appeal, and opt-out where appropriate. Do not train on tenant/candidate data without explicit lawful agreement.
15. Establish retention schedules by entity and jurisdiction, including inactive accounts, resumes, rejected applications, assessment responses, interview feedback, offers, notifications, provider logs, and audit data.

## 20. MVP Definition

For an MCA project, the MVP should demonstrate one complete and coherent hiring cycle rather than every backend capability.

### Must-have

- Candidate and recruiter registration/login/logout/session handling.
- Platform-admin login seeded/managed outside public registration.
- Candidate profile, skills, projects, completion, visibility, and resume.
- Recruiter approval; company creation and verification; recruiter owner membership.
- Job draft, submit for review, admin approve, publish, search/detail.
- Candidate eligibility check, application, own tracking, withdrawal.
- Recruiter application list/detail, deterministic skill breakdown, notes/tags, valid stage movement.
- One objective assessment flow with assignment, autosave, submit, grading, and result release.
- One interview round with availability/scheduling, candidate response, scorecard, and completion.
- Offer draft, simple approval, send, candidate accept/decline, hire confirmation.
- In-app notifications, essential email only if a safe provider configuration is available.
- Permission/tenant enforcement, responsive candidate UI, accessibility baseline, and core integration tests.

### Should-have

- Reusable assessment/interview/offer templates where existing backend support makes them inexpensive.
- Document verification queue for submitted evidence.
- Recruiter dashboard for aging items and simple job/pipeline analytics.
- Admin health/aggregate overview.
- Data export/deletion policy design, even if execution is deferred.

### Could-have

- Resume extraction, job-description suggestions, saved recruiter views, calendar file export, candidate job bookmarks, richer email templates, and named permission presets.

### Not now

- GitHub OAuth/analysis, AI ranking, subjective AI scoring, chat, proctoring surveillance, video/calendar OAuth, billing, e-signature, payroll/background checks, multi-organization membership, institution portals, centralized enterprise BI, and native mobile apps.

The MVP should support Candidate, Hiring Team Member, and Platform Administrator. Organization Owner should be merged with the first recruiter as a recruiter-admin/owner membership, matching the current model. A fourth top-level account role would add routing, onboarding, permission, and testing complexity without product benefit.

## 21. Roadmap

| Phase | Goals and deliverables | Dependencies | Completion criteria |
| --- | --- | --- | --- |
| 1. Product and authentication foundation | Approve blueprint/MVP; frontend shell; auth/session; role-aware navigation; candidate/recruiter onboarding; error/accessibility patterns | Product decisions, frontend stack, auth API | Three implemented account roles can securely enter correct workspace; denied/expired states verified |
| 2. Jobs and applications | Company setup/verification UI; job editor/review/public discovery; candidate application and recruiter pipeline | Phase 1, verified tenant policies, design system | Candidate submits once to an eligible job; team reviews and valid transitions persist with notifications |
| 3. Assessments and pipeline | Objective question/assessment management; assign; safe attempt autosave/submit/result; pipeline integration | Application flow, server time, snapshot policy | End-to-end assessed candidate path works; no answers/hidden tests leak; expiry/retry tested |
| 4. Interviews and organization management | Interview templates/process/schedule/response/scorecard; team permissions; offers and hire completion | Team membership decisions, time-zone UX, pipeline | Multi-actor interview and offer response complete; private feedback and terms remain scoped |
| 5. AI assistance and verification | Consent model; resume extraction or JD assistant pilot; explainable match research; GitHub/project verification discovery | Privacy impact review, evaluation set, provider/security decisions | Pilot beats manual baseline on defined measure, exposes evidence/limits, and fails safely; no autonomous decisions |
| 6. Advanced analytics and scaling | Owner analytics, saved views, centralized audit logs, integrations, retention automation, performance/tenant scaling | Stable event definitions, metric catalog, audit/retention policy | Metrics are defined/reproducible, high-risk actions auditable, scale/security tests pass |

No exact dates are proposed because the repository contains no supported delivery estimates.

## 22. Decisions Required

| Question | Options | Recommendation | Reason / impact | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Four top-level roles or three? | Add owner role / use recruiter membership | Three; owner as privileged membership | Matches code and supports future tenant roles without identity proliferation | Product + engineering | Open |
| Organization onboarding | Self-serve + admin verify / invite-only / admin-created | Self-serve approved recruiter, admin verification | Existing flow; needs clear evidence/resubmission UX | Product + trust | Open |
| Who publishes jobs? | Admin approval / owner approval / permission holder direct | Admin approval for academic MVP; owner/policy later | Existing state machine and trust control; may become operational bottleneck | Product + trust | Open |
| Candidate profile visibility | Public default / recruiters-only / private | Recruiters-only default with explicit public opt-in | Matches model and privacy-by-default | Product + privacy | Open |
| Apply without completed profile? | No / threshold per job / always | Job-set threshold plus resume rule | Existing flexible eligibility; explain missing requirements | Product | Open |
| GitHub access scope | Public metadata / selected repos / all including private | Selected public repos first; private only explicit later | Least privilege and attribution risk | Product + security | Open |
| Assessment proctoring | None / lightweight integrity events / surveillance | No invasive proctoring; transparent lightweight signals | Accessibility/privacy and false positives | Product + legal | Open |
| AI ranking visibility | Recruiter only / candidate explanation / no ranking | No MVP ranking; later show factors to recruiter and meaningful explanation/appeal to candidate | Accountability and fairness | Product + AI governance | Open |
| Messaging model | No chat / application-scoped async messages / open inbox | No chat in MVP; notifications and structured requests | Avoid moderation and expectation burden | Product | Open |
| Subscription/billing timing | MVP / post-MVP / never academic | Post-MVP | No repository evidence; distracts from complete hiring flow | Product/business | Open |
| Campus recruitment | MVP / phase 2 specialization / general workflow only | General workflow in MVP; campus specialization later | `campus` source exists but institution model/workflows do not | Product | Open |
| Company “needs information” state | Add now / use rejection notes | Add post-MVP or before real verification operations | Better resubmission UX, but schema/state/API change required | Trust + engineering | Open |
| Ownership transfer | Supported / admin-mediated / absent | Admin-mediated initially, formal workflow later | Prevent orphaned tenants and privilege takeover | Product + security | Open |
| Multi-company recruiters | One / multiple | One in MVP; membership model later | Current recruiter profile holds one company | Product | Open |
| General user suspension/appeal | Domain-specific only / centralized case flow | Define centralized case and appeal before production | Current admin controls are uneven | Trust + legal | Open |
| Closed-job candidates | Auto-reject / retain stages / manual resolution required | Require team resolution or explicit bulk action with notice | Avoid silent adverse outcomes | Product | Open |
| Data retention/deletion | Fixed periods / tenant-configurable / indefinite | Policy-based defaults with legal holds and candidate transparency | Essential before production | Legal + product | Open |

## 23. Assumptions and Open Questions

### Confirmed facts, not assumptions

- The frontend has no initialized application or routes; it is a reserved directory.
- The backend is an Express/Mongoose modular monolith with three top-level roles.
- Current AI matching is not implemented; deterministic skill matching is implemented.
- GitHub exists only as candidate social/project URLs; no OAuth or analysis exists.
- Notifications exist; user-to-user messaging does not.
- Admin aggregate analytics exist; a centralized audit-log model does not.

### Assumptions requiring confirmation

1. Talvix's initial market is direct employer hiring rather than staffing agencies or institutions.
2. One user has one top-level identity role; role switching is not required in MVP.
3. One recruiter belongs to at most one company in MVP.
4. The first company creator is the owner and cannot be removed without a transfer process.
5. Recruiter approval is separate from company verification and both remain required.
6. Admin review of every job is acceptable for the academic MVP.
7. Candidates may browse jobs while signed out but must sign in to apply.
8. A configurable completion threshold, not 100% completion, determines application eligibility.
9. Recruiter-only is the desired default profile visibility.
10. Deterministic skill match may be shown as a fit aid but never as an automatic rejection rule.
11. Candidates should understand major match factors and missing required skills.
12. Assessment results are released deliberately, not always immediately after grading.
13. Coding questions remain manual/unavailable until isolated execution is separately approved.
14. Interview meeting links are external metadata; Talvix does not host calls.
15. Submitted feedback remains immutable except reasoned admin reopen.
16. Offer acceptance is not equivalent to hired until recruiter confirmation.
17. In-app notifications are authoritative; email is an optional delivery channel.
18. Billing and subscription entitlements do not affect MVP permissions.
19. There is no need for real-time candidate–recruiter chat in MVP.
20. Platform administrators need case/audit tooling before production, beyond current domain controls.
21. Resume/project/GitHub/AI retention and consent will be defined before those features launch.
22. Public candidate profiles, if allowed, exclude contact and sensitive fields by default.
23. Organization owners may delegate all operational permissions but ownership itself needs stronger protection.
24. The MCA evaluation values a demonstrable complete flow over production-scale integrations.

Open product questions also include password recovery and email verification; invitation acceptance; profile contact-field visibility; candidate correction/appeal paths; bulk actions; application withdrawal consequences; assessment accommodations; interview cancellation windows; offer negotiation limits; notification retention; export rights; account deletion; support tooling; localization/time zones; institution support; and legal jurisdiction.

## 24. Repository Evidence

| Finding | Repository file or folder | What it indicates | Confidence |
| --- | --- | --- | --- |
| Product positioning is evidence-based hiring | `README.md` | Explicit repository description | High |
| Frontend is deferred and has no routes/package | `frontend/README.md`, `frontend/` | No implemented UI should be claimed | High |
| Express modular monolith and module list | `backend/README.md`, `backend/src/app.js`, `backend/src/routes/index.js` | Implemented API boundaries | High |
| Three top-level roles; only candidate/recruiter public registration | `backend/src/constants/roles.js`, `backend/src/models/User.js` | Owner is not a fourth account role | High |
| Owner is recruiter membership with all permissions | `backend/src/models/RecruiterProfile.js`, `backend/src/models/Company.js`, `backend/src/services/company.service.js` | Organization owner is tenant-scoped | High |
| Granular hiring permissions | `backend/src/constants/permissions.js` | Supports hiring subroles as presets | High |
| Authorization reloads active user/membership/permissions/company status | `backend/src/middleware/auth.js`, `authorizePermissions.js`, `companyAccess.js` | JWT claims are not trusted for tenant authority | High |
| Candidate structured profile, projects, GitHub URL and privacy | `backend/src/models/CandidateProfile.js`, `backend/src/routes/candidate.routes.js` | Profile CRUD/search exists; GitHub integration does not | High |
| Job lifecycle and admin publication review | `backend/src/models/Job.js`, `backend/src/constants/job.js`, `backend/src/routes/job.routes.js` | Job management/discovery implemented | High |
| ATS snapshots, deterministic skill score and rich statuses | `backend/src/models/Application.js`, `backend/src/utils/skillMatch.js`, `backend/src/routes/application.routes.js` | Existing application/pipeline capabilities | High |
| Assessment engine and safe candidate serialization | `backend/src/models/Assessment*.js`, `Question.js`, `backend/src/routes/assessment.routes.js`, tests | Assessment creation, assignment, attempt, grading/review implemented | High |
| Candidate code is not executed in process | `backend/src/services/codeExecution.service.js`, `backend/README.md` | Default coding evaluation is unavailable/manual | High |
| Structured multi-round interviews | `backend/src/models/Interview*.js`, `backend/src/routes/interview.routes.js` | Scheduling, availability, feedback, analytics implemented | High |
| Offer approval/revision/response workflow | `backend/src/models/Offer*.js`, `backend/src/routes/offer.routes.js` | Offers are implemented without e-signature/payment | High |
| Persisted notifications and optional email | `backend/src/models/Notification*.js`, `backend/src/routes/notification.routes.js`, `.env.example` key names | Inbox/preferences/outbox/templates exist; provider optional | High |
| Private document system and workflow attachment rules | `backend/src/models/Document.js`, `backend/src/routes/document.routes.js`, document tests | Secure uploads, quotas, signed delivery, retention and verification implemented | High |
| Admin aggregate analytics and safe export | `backend/src/routes/adminAnalytics.routes.js`, `backend/src/services/adminAnalytics.service.js` | Platform analytics backend exists | High |
| No centralized audit-log model | `backend/src/models/`, `backend/README.md` admin analytics section | Histories/audit arrays exist only inside domains | High |
| AI service is outside current scope | `README.md`, `AGENTS.md`, absence of AI models/routes | AI features are future recommendations | High |
| No calendar/video/OCR/malware/e-signature integrations | `backend/README.md`, `.env.example` key names | Provider metadata or scan state must not be mistaken for integrations | High |
| Integration tests cover transactions, concurrency and privacy | `backend/test/` | Backend claims have automated evidence | High |
| Environment supports JWT, MongoDB, optional Resend and Cloudinary | `backend/.env.example` key names only | Operational integrations without exposing values | High |

## 25. Recommended Next Step

1. Review this blueprint with the product owner.
2. Resolve every “Decision required” item, beginning with role/onboarding, job approval, profile visibility, eligibility, and retention.
3. Freeze the MCA MVP scope and acceptance criteria.
4. Produce a Figma design brief grounded in the confirmed backend and MVP journeys.
5. Create low-fidelity wireframes for the complete candidate, recruiter-owner, and admin path.
6. Create the visual design system, including accessibility and workflow-state patterns.
7. Build and test an interactive prototype with representative users.
8. Begin implementation only after product-owner approval.

The immediate design deliverable should not attempt to expose every backend endpoint. It should prove a coherent hiring story, make permissions and state visible, and leave AI, GitHub, billing, chat, and advanced governance clearly labeled as later work.
