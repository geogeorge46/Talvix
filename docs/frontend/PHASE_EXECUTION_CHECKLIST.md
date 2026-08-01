# Talvix frontend phase execution checklist

> **Historical Phase 0 checklist.** It is retained as planning provenance and
> does not describe current implementation status.

## Phase 0 closeout

- [x] Audited complete repository boundaries, frontend inventory, backend routes/controllers/services/validators/models, auth/authorization, packages, environment key names, READMEs, product blueprint and all design-system documents.
- [x] Confirmed repository visual reference is missing; temporary attachment was readable but not copied.
- [x] Created API/UI mapping, route/permission matrix, dependency decisions and phased plan.
- [x] Recorded dashboard aggregate and AI gaps.
- [x] Made no frontend/backend implementation changes and installed no packages.
- [ ] Product/architecture/security/platform owners approve all Phase 1 decision gates.

**Go/no-go:** conditional GO for Phase 1 foundation only after dependency/deployment/CSP/font/headless/browser decisions and repository visual asset are approved. NO-GO for feature work or exact dashboard parity.

## Phase 1 — foundation, toolchain, tokens and auth shell

**Prerequisites:** approve the frontend-stack ADR—until then every core-stack package is **Decision Required — recommended option (approval pending)**—and close decisions in [`DEPENDENCY_DECISIONS.md`](DEPENDENCY_DECISIONS.md); durable visual reference; supported Node/browser/deployment matrix; auth/CORS/CSP review.

- Record and execute the ADR: React 19 plus either current verified TypeScript 7.0.2/Vite 8.1.5/React Router 8.2.0 or the brief’s supported-fallback baseline TypeScript 5.9/Vite 7/Router 7. The fallback is no longer “current” and needs written compatibility/security/maintenance rationale. Vite 8 requires Node 20.19+ or 22.12+.
- Encode canonical semantic CSS variables, Geist/fallbacks, reset, focus/reduced-motion utilities and Tailwind mapping if approved.
- Add API client, runtime DTO parsing, normalized errors, in-memory bearer session, single-flight refresh, Query provider and user-cache clearing.
- Add public/auth/candidate/org/admin layouts, single nav model, guards, loading/empty/error/denied/session/company-state routes, and guarded `/recruiter/*` plus admin notification compatibility aliases. Keep interview `scheduleId` and `processId` canonical routes distinct and add the safe legacy resolver.
- Build minimum primitives needed by shell: Button, Link, form controls, Alert, Dialog/Drawer, Menu, Tooltip, Skeleton and status tone mapping.
- Add lint/format/typecheck/Vitest/Testing Library/MSW/axe/Playwright CI.

**Acceptance/tests:** no raw product hex/spacing outside tokens; keyboard navigation and focus recovery; WCAG 2.2 AA contrast; 320px–1440px plus 200% zoom; reduced motion; cross-origin register/login accept the refresh `Set-Cookie`, refresh is one-flight and replay-once, logout clears it, allowed origin succeeds and unapproved origin is rejected; no token persistence; direct URL role/permission tests; every emitted notification action URL resolves or safely denies, including `/recruiter/profile`→`/org/profile`, `/candidate/documents`, and schedule-vs-process interview links; route-level split/bundle baseline.

**Exit:** clean reproducible install/build; approved tokens visually match durable reference; shell handles every auth/org state; CI green. Dashboard data parity is not required and AI is absent.

## Phase 2 — public discovery, company and candidate profile

**Prerequisites:** Phase 1; public DTO fixtures; profile/document capability/limit decision.

- Public jobs/company lists/details with URL search/filter/page and safe salary/company projections.
- Candidate profile/evidence CRUD, completion UI and personal resume/photo/document manager.
- Recruiter profile/company onboarding and company status surfaces; managed job list/editor/lifecycle if approved in scope.

**Acceptance:** public/candidate/recruiter DTO separation; server threshold for job eligibility; upload failure/replace/quarantine states; labelled filters, error summary, 44px actions; mobile list recomposition; search abort/cache tests; no provider/checksum/signed-URL telemetry.

**Exit:** public browse and candidate profile smoke paths pass; company pending/rejected/suspended states verified. **Dependency:** sanitized upload capabilities endpoint is Important; without it client limits remain hints and server errors authoritative.

## Phase 3 — applications and pipeline

**Prerequisites:** safe application DTO fixtures, exhaustive statuses, pipeline accessible-list design; decide whether recruiter overview uses fan-out or waits for aggregate API.

- Candidate submit/list/detail/timeline/withdraw/offer-response/snapshot refresh.
- Recruiter list, PipelineList + PipelineBoard, detail, deterministic skill evidence, notes/rating/tags/assignees/stage commands and job statistics.
- Admin application oversight only if sequencing permits; otherwise Phase 6.

**Acceptance:** ownership/company scope tests; recruiter notes never enter candidate fixture/snapshot; no “AI match” wording; keyboard pipeline and list equivalence; optimistic UI limited to reversible presentation; 409 refetch/reconcile; filters usable at 320px.

**Exit:** candidate apply-to-track and recruiter review-to-transition journeys pass. **Dependency:** aggregate dashboard blocks exact overview, not the pipeline workspace.

## Phase 4 — assessments

**Prerequisites:** immutable snapshot/attachment contracts; server-time strategy; code-execution-unavailable copy.

- Recruiter question bank, definitions, publishing/cloning, assignments, pipeline, review/scoring/release.
- Candidate assignment, attempt timer/navigation, autosave, submit and permitted result; admin corrective screens as scheduled.

**Acceptance:** negative tests prove no answers, explanations, hidden tests, raw snapshots or internal scoring in candidate UI; no in-process/client code execution; serialized autosave, offline/error recovery and expiry race tests; full keyboard question navigation; timer not color-only; attachment policy server-derived; mobile attempt remains usable.

**Exit:** publish→assign→attempt→review→release journey passes with manual privacy/a11y review.

## Phase 5 — interviews, offers and organization operations

**Prerequisites:** UTC/IANA copy, interview/offer state adapters, owner capability model, document paired-permission tests.

- Interview templates/process/scheduling/availability/feedback/scorecards and candidate response.
- Offer templates/drafts/approval/send/candidate response/negotiation/revisions/hire confirmation.
- Company editor, team/permission management, document verification and safe workflow attachments.

**Acceptance:** candidate interview excludes private feedback/instructions/security/audit; candidate offer excludes approvals/snapshots/internal actors/corrections; owner never appears as fourth role; paired permissions tested; submitted feedback immutability; consequential time/currency/action confirmation; list alternatives and narrow-screen dialogs; no calendar/video/PDF/e-signature claims.

**Exit:** schedule→evaluate and draft→approve→send→respond→hire smoke paths pass across distinct users with concurrency tests.

## Phase 6 — notifications, admin and analytics

**Prerequisites:** admin route fixtures; aggregate privacy policy; chart dependency review; export/download controls.

- Notification inbox, unread state and preferences; admin template/outbox/email-log operations.
- Recruiter/company/job/domain approval and corrective queues.
- Admin aggregate analytics, UTC filters, health and safe export; Recharts only if approved.

**Acceptance:** admin-only direct URL/API tests; masked email data; no PII in analytics/telemetry; chart data tables and keyboard operation; UTC boundary tests; CSV injection prevention for client-produced content; narrow-screen queue actions; polling bounded and paused when hidden.

**Exit:** admin approval/oversight/analytics and user notification journeys pass, including persisted recruiter/admin/candidate deep links; operational permissions and rollback runbook approved.

## Future — separately approved capabilities

AI, GitHub, chat, billing, calendar/video providers, OCR, e-signature and centralized audit-log UI remain **Future**. Each needs product policy, backend/API, consent/privacy/security threat model, dependency review, transparency and correction paths. AI may not autonomously decide or rank hiring outcomes. Do not install SDKs or reserve active navigation now.

## Release and CI checklist

- [ ] Frozen lockfile install; build, strict typecheck, lint and format checks.
- [ ] Unit/adapters/status tests; MSW contract/error/privacy fixtures; component interaction/axe tests.
- [ ] Playwright smoke on approved browsers: public job, login/refresh/logout, candidate application, recruiter scoped workflow, admin denial/approval path.
- [ ] Manual keyboard, screen reader, 200%/400% zoom where applicable, reduced motion, contrast and touch-target review.
- [ ] Dependency advisory/license review, CSP/security headers, no source maps or env secrets exposed unintentionally.
- [ ] Route chunks and asset budgets; no avoidable layout shift; cancellation/bounded pagination.
- [ ] Sanitized observability with correlation IDs, no response bodies/PII/signed URLs; alert ownership documented.
- [ ] Immutable deployment artifact, health check, rollback to prior version, backend compatibility window and feature-flag kill switch where approved.

## Definition of done for every feature

A feature is done only when implemented against an evidenced API contract; exact role/permission/ownership and state transitions are tested; loading/empty/error/401/403/404/409/422 states are usable; safe role-specific DTOs are enforced; keyboard/screen-reader/contrast/zoom/reduced-motion and narrow-screen behavior pass; cache invalidation/concurrency are explicit; telemetry is sanitized; documentation and smoke coverage are updated; and no Future capability is implied.

## Phase 1 handoff decision

Phase 0 stops here. Phase 1 is not authorized by this document. Once the readiness gates in [`FRONTEND_READINESS_AUDIT.md`](FRONTEND_READINESS_AUDIT.md) are approved, Phase 1 may initialize foundations only; feature phases require their own entry criteria and relevant API gaps to be closed or consciously accepted.
