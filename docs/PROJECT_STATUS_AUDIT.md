# Talvix project status audit

> **Superseded on 2026-07-21.** This rolling phase-era audit is retained for
> historical context. Use [PROJECT_PROGRESS_REPORT.md](./PROJECT_PROGRESS_REPORT.md)
> for current status, [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) for feature
> classification, and [AI.md](./AI.md) for as-built context.

**Audit date:** 2026-07-20  
**Classification:** Functional beta

## Method

Percentages are evidence-based readiness scores, not estimates of elapsed engineering time. Each domain was scored against the implemented backend contract, persisted model, authorization, integrated frontend route, automated verification, and local/deployment operability. A backend-only domain cannot score as a complete user-facing module.

## Current project completion

| Area | Completion | Evidence and remaining work |
| --- | ---: | --- |
| Overall | 80% | Core backend, recruiter workflows, organization administration, and substantial candidate workflows are functional; candidate contract breadth, admin UI, interview contracts, deployment automation, and browser E2E remain incomplete. |
| Backend | 94% | Modular routes/controllers/services/validators/models cover all principal domains. Remaining gaps include recruiter live interview-round DTOs, scorecard-task/overdue contracts, scheduling concurrency, and centralized audit logging. |
| Frontend | 82% | Design system, shell/auth, recruiter domains, organization administration, and core candidate routes are integrated. Candidate profile-photo/basic-account editing, full notification bulk/detail UX, analytics/admin screens, and browser E2E remain absent. |
| Database/models | 92% | Major entities, indexes, snapshots, outbox, quota and workflow records exist. Interview feedback deadlines/actionable task modeling and centralized audit records are missing. |
| Authentication/authorization | 92% | Login, registration, refresh rotation, logout, role guards, persisted recruiter permission and company checks are implemented. Password reset and email verification workflows are intentionally unsupported; browser E2E coverage remains. |
| Candidate module | 84% | Candidate deadline/action dashboard, profile and core collection CRUD, public jobs/question-aware apply with local drafts, safe applications/timeline/withdrawal, assessments, interviews, offers, documents, notifications/preferences, privacy and account settings are routed to owned contracts. Specialized profile photo, complete optional collection fields, notification detail/bulk UX, upload polling, server-safe notification targets, browser E2E and backend-blocked security/account controls remain. |
| Recruiter module | 86% | Dashboard, jobs, ATS, assessments, offers/documents, company profile/settings, and team permission management are integrated alongside partial interviews. Organization analytics/exports and backend-blocked live interview scheduling/scorecard tasks remain. |
| Organization administration | 88% | Company overview/create/edit, safe verification states, complete supported profile fields, protected drafts, supported settings, team search/detail/add/update/remove, and grouped permission editing use `/companies`. Invitations, organization analytics/exports, recruiter search, custom roles, owner transfer, branding uploads, and organization deletion have no supporting contracts and are explicitly unavailable. Browser E2E remains. |
| Admin module | 40% | Backend administration exists for recruiters, companies, jobs, applications, assessments, interviews, offers, documents, notifications and analytics. Frontend admin routes are primarily placeholders. |
| Job management | 88% | Backend lifecycle and recruiter list/detail/create/edit actions are integrated and tested. Public/candidate job discovery UI and full admin review UI remain. |
| Application tracking | 82% | Backend candidate/recruiter/admin workflows and recruiter ATS UI are strong. Candidate application UI and admin inspection UI remain incomplete. |
| Assessments | 80% | Backend definitions, questions, assignments, attempts, review and result release exist; recruiter/candidate frontend flows and resilience tests exist. Some authoring breadth and cross-browser verification remain. |
| Interviews | 62% | Backend workflow is broad and candidate UI is partially integrated. Recruiter live round DTOs, authoritative overdue scorecards, concurrency, and multiple Phase 9 recruiter surfaces remain blocked/incomplete. |
| Offers | 86% | Recruiter templates, drafts, create/edit, approval, detail, revisions, attachments and candidate list/detail/respond journeys use the real backend. Remaining gaps are server capability/version DTOs, list/approval pagination limitations, ignored managed-list filters, broader browser E2E, and admin UI. |
| Notifications | 68% | Backend inbox and preferences are surfaced through a candidate-safe notification center with strict route target allowlisting. Full preference editing, recruiter/admin notification products and browser coverage remain. |
| Files/documents | 78% | Candidate ownership manager, server-constrained upload/replace/download/delete handling, offer attachments, and recruiter application-document verification are integrated. The backend has no organization-wide document repository, replacement-request action, offer-attachment delete/access update, or processing-status polling; admin UI and a real malware provider remain. |
| Analytics | 45% | Backend admin analytics and exports are comprehensive; recruiter dashboard uses selected aggregates. Dedicated recruiter/admin analytics pages are missing. |
| Testing | 85% | Backend integration coverage exercises transactions, privacy, permissions and concurrency; frontend has component/route/a11y-oriented tests. No full browser E2E suite, coverage threshold, or broad device/AT matrix exists. |
| Deployment readiness | 52% | Environment validation, health endpoint and production builds exist. CI/CD, container/hosting configuration, production CSP/origin decisions, observability, migrations/runbooks and deployed smoke tests remain. |

## Module status

| Module | Completed | Partial | Missing | Testable now | Integration still required |
| --- | --- | --- | --- | --- | --- |
| Authentication/authorization | Register/login/logout/refresh/me, role middleware, persisted recruiter permissions and company membership checks | Frontend session restoration and route guards need browser-level verification | Password reset and email-verification workflows | API integration suite and local role logins | Production cookie/CORS/CSP verification and E2E |
| Candidate | Backend ownership contracts plus candidate dashboard, profile, jobs/apply, applications, assessments, interviews, offers, documents, notifications and settings frontend | Optional nested-profile breadth, profile-photo integration and notification bulk/detail polish | Browser E2E and backend-blocked security/account controls | Integrated RTL journey and candidate APIs | Remaining contract polish and browser/AT verification |
| Recruiter | Backend company/team and every hiring domain; dashboard, jobs, ATS, assessment, offers and document verification UI | Interview UI and document verification context hub | Company/team and dedicated analytics pages; organization-wide document repository has no API | Existing integrated UI and backend APIs | Phase 10 interview backend roadmap plus remaining recruiter pages |
| Admin | Full backend administrative route families and analytics | Shell and validated placeholder routes | Product dashboards, queues, decisions and reports | All admin APIs | Complete admin frontend |
| Jobs | Lifecycle, permissions, validation, public discovery, recruiter CRUD/lifecycle UI | Admin review only through API | Candidate job browsing/application UI and admin review UI | Recruiter UI and all APIs | Candidate/admin pages |
| Applications | Candidate/recruiter/admin backend, pipeline, notes, ratings, tags, assignees; recruiter ATS UI | Candidate detail routes are placeholders | Candidate application center and admin inspection UI | Recruiter UI and APIs | Candidate/admin pages |
| Assessments | Definition/question/assignment/attempt/review APIs and recruiter/candidate UI | Some advanced authoring/browser coverage | Isolated code execution by design | Core workflows and resilience tests | Wider browser/AT verification |
| Interviews | Broad process/schedule/availability/feedback APIs and candidate/partial recruiter UI | Phase 9 surfaces and DTO adapters | Live managed-round DTO, authoritative overdue task contract and concurrency token enforcement | Backend workflows and partial UI | Phase 10 backend then recruiter UI completion |
| Offers | Templates, drafts, approvals, revisions, lifecycle actions, candidate responses and exact-revision attachments across backend and recruiter/candidate UI | Candidate list and approval queue are unpaginated; no server capability/version DTO | Admin product pages | Recruiter/candidate UI and APIs | Admin UI, browser E2E, backend pagination/capability improvements |
| Notifications | Inbox, preferences, templates, outbox, recipient policies and retries | Global trigger exists | Notification center and settings UI | APIs and failure tests | Frontend pages |
| Documents | Private upload/delivery, quotas, owner manager, server-constrained uploads, offer attachments, verification and cleanup | Recruiter UI is a verification/context hub; storage can be disabled locally | Organization-wide repository, replacement-request action, attachment deletion/access update, admin UI and real malware engine | Candidate manager, recruiter verification and APIs | Missing backend capabilities, admin UI, optional provider setup |
| Analytics | Admin aggregate reports, time series, exports and health backend; recruiter overview uses selected APIs | Dashboard metrics have documented endpoint limits | Dedicated admin/recruiter analytics UI | API reports and dashboard | Reporting pages and visualization coverage |

### Completed or substantially complete

- Backend authentication, refresh-token rotation, authorization middleware and company access enforcement.
- Backend candidate/recruiter profiles, companies, jobs, applications, assessments, offers, notifications, documents and aggregate analytics.
- Frontend design system, responsive shell, protected routing, recruiter dashboard, job management and recruiter ATS workspace.
- Transaction-aware document quota, retention, cleanup and notification-outbox behavior.
- Local-only, idempotent demo seed with representative workflow data.

### Partially complete

- Candidate frontend: all principal candidate routes exist; optional profile breadth, specialized photo delivery, notification bulk/detail polish and broader assistive-technology coverage remain partial.
- Recruiter frontend: dashboard/jobs/ATS/assessments/offers/document verification and company/team administration exist; interviews are incomplete and organization analytics/exports are explicitly backend-blocked.
- Interview backend: mutations exist, but managed process detail does not provide live round/schedule/scorecard state and feedback queues cannot enumerate missing/overdue work.
- Assessment frontend: core flows are testable, but broad browser/assistive-technology coverage remains.
- Analytics: backend reports are testable; dedicated frontend reporting is not.

### Missing

- Product-grade admin frontend.
- Candidate browser E2E and specialized profile-photo/account-security experiences.
- Organization-scoped analytics/export contracts, invitation workflows, recruiter discovery, custom organization roles, and owner-transfer APIs.
- Authoritative interview scorecard-task/deadline API and safe live-round DTO.
- Browser E2E automation and deployment configuration.
- Central audit-log model for administrative/export activity.
- AI matching/evaluation, OCR, malware engine, electronic signatures and external calendar/video provisioning are intentionally not implemented.

## What is currently testable

- All backend APIs through automated integration tests and an API client.
- Admin/recruiter/candidate login with seeded local accounts.
- Recruiter dashboard, jobs, application/candidate workspace, assessment workflows and partial interview workflows.
- Candidate assessment and partial interview workflows.
- Offer and document workflows through integrated recruiter/candidate UI; notifications and analytics remain primarily API-only.
- Disabled file/email provider behavior without external credentials.

## Known blockers

1. Managed interview process responses do not include authoritative live round, schedule, interviewer and scorecard state.
2. Interview feedback queues cannot represent missing or overdue scorecards.
3. Most admin functionality has no finished frontend.
4. Document replacement-request, company-wide repository, offer attachment delete/access-toggle, and processing-status polling contracts do not exist; the frontend exposes these as unavailable rather than simulating them.
5. Offer DTOs have no server capability matrix or concurrency version, candidate lists and approval queues lack usable pagination, and managed search/employment filters are not applied.
6. No end-to-end deployed test environment or automated deployment pipeline exists.
7. Candidate notifications do not include a server-authored safe-target DTO; the frontend ignores `actionUrl` and maps only known type/id pairs.
8. The HTTP client can automatically retry a mutation after a 401. Phase 12 candidate mutations opt out, but the global default remains a cross-module consequential-action safety risk.

## Security concerns

- Demo credentials are intentionally public and must remain local-only; the seed hard-blocks `NODE_ENV=production`.
- Local JWT secrets must be unique, random and at least 32 characters; never reuse example values in production.
- The frontend keeps bearer access tokens in memory and uses an HttpOnly refresh cookie, which is appropriate; production CORS, cookie security and CSP still require deployment verification.
- File uploads should remain disabled unless a supported private provider is configured and validated.
- Candidate privacy boundaries are enforced server-side, but browser E2E regression coverage is still needed.
- The lack of a centralized audit-log entity limits production-grade administrative traceability.

## Testing readiness

The repository is ready for local functional and API testing. It is not ready for release-candidate sign-off because several roles reach placeholders and no browser E2E suite verifies complete cross-role workflows.

## Deployment readiness

Development and production builds are available, but production deployment is not turnkey. Before production, add CI quality gates, managed environment/secrets, HTTPS/cookie/CORS validation, database backup/index procedures, worker/outbox operations, observability, and deployment smoke/rollback runbooks.

## Recommended next five tasks

1. Implement the Phase 10 interview backend roadmap: live round DTOs, scorecard tasks/deadlines and scheduling concurrency.
2. Complete candidate job/application/profile/notification frontend journeys and contextual application-document navigation.
3. Build the admin workspace against existing administration APIs.
4. Add organization analytics/export contracts if approved and broaden company/team/offer/document browser E2E.
5. Add Playwright-style cross-role E2E tests and CI/deployment automation.
