# Talvix Master Context for AI Agents

**Last audited:** 2026-07-21. Read `AGENTS.md` first. This file is the as-built orientation; validators, routes, services and models remain authoritative.

## Product overview

Talvix is an evidence-based recruitment platform for candidates, organization recruiters and platform administrators. It supports structured jobs, applications, assessments, interviews, offers, notifications and private documents. The current classification is **Functional Beta**: approximately 77% overall, 93% backend, 75% frontend and 52% deployment readiness. See `PROJECT_PROGRESS_REPORT.md` for the scoring method.

## Architecture and technology

- Frontend: React 19, TypeScript, Vite, React Router, TanStack Query, selected Radix primitives, Lucide icons, Geist/Geist Mono, Vitest, Testing Library and axe.
- Backend: Node.js/Express ES modules, Zod validation, Mongoose/MongoDB, JWT access and refresh tokens, bcrypt, Vitest/Supertest with `mongodb-memory-server` replica sets.
- Optional services: Cloudinary private file storage and Resend email. Both default disabled.
- Architecture: versioned routes → authentication/authorization → strict validators → controllers → services → Mongoose models. Controllers translate HTTP; services own business rules, persistence, transactions and events.
- Frontend organization: `src/app`, `api`, `auth`, `routing`, `layouts`, `shell`, semantic `design-system`, and domain `features`.
- Backend organization: `src/routes`, `controllers`, `services`, `validators`, `models`, `middleware`, `constants`, `utils`, `shared`, `scripts`.

## Database

Main collections/models include User, CandidateProfile, RecruiterProfile, Company, Job, Application, Question, Assessment, AssessmentAssignment, AssessmentAttempt, InterviewTemplate, InterviewProcess, InterviewRound, InterviewSchedule, InterviewAvailability, InterviewFeedback, OfferTemplate, Offer, Document, FileUploadSession, StorageReservation, UserStorageUsage, Notification, NotificationPreference, NotificationTemplate, NotificationOutbox, EmailLog and Counter.

Transaction-capable MongoDB is required for reservation/upload and other atomic workflows. There is no migration framework or production index rollout runbook.

## Authentication and authorization

Global roles are exactly `candidate`, `recruiter`, and `admin`. Organization Owner is not a fourth role; ownership is a privileged organization membership. The frontend keeps access tokens in memory. The refresh token is an HttpOnly cookie and is rotated by `/auth/refresh`.

Recruiter company access must reload the active recruiter profile, active company, active embedded membership and permissions from MongoDB. Never authorize from JWT role/permission claims alone. Frontend gating is UX only; server responses are authoritative.

Known risk: the shared HTTP client can retry requests after a 401, including mutations unless the caller opts out. Consequential mutations must never be automatically replayed after reauthentication.

## Domain map

- Candidate: owned profile and collection CRUD, job discovery/application, application timeline/withdrawal, assessments, interviews, offers, documents, notifications and supported settings.
- Recruiter: company/team, dashboard, job management, ATS, assessments, partial interview management, offers and contextual document verification.
- Admin: comprehensive backend review/correction routes and aggregate analytics; product UI is mostly placeholders.
- Organization: company profile and team permission management. Invitations, recruiter search, custom roles, owner transfer, organization analytics/export and deletion are unsupported.
- Jobs: draft/review/publish/pause/close/archive lifecycle; public discovery includes only active verified companies and eligible published jobs.
- Applications: detached snapshots, concurrency-safe numbering, deterministic skill match, candidate ownership and recruiter pipelines.
- Assessments: immutable assignment grading snapshots, objective/manual review, candidate-safe questions, server-controlled timing. Candidate code is never executed in-process; production code execution is unavailable.
- Interviews: process/round/schedule/availability/feedback workflows with UTC instants and privacy serializers. Managed live-round and overdue scorecard-task contracts remain incomplete.
- Offers: templates, approval, immutable revisions, negotiation, candidate response and hiring confirmation. No e-signature/PDF/payroll workflow.
- Documents: private uploads, dynamic constraints, quotas, signed downloads, contextual entity attachments, retention/cleanup and application verification. No organization repository, processing polling or real malware provider.
- Notifications: persisted outbox, deduplication, recipient revalidation, optional email, owned inbox/preferences and admin templates/operations.
- Analytics: aggregate admin-only UTC-bounded reports and safe JSON/CSV export. Dedicated admin/recruiter analytics UI is absent.

For route families and frontend paths, read `API_AND_ROUTE_MAP.md`. For supported/partial/unsupported classification, read `FEATURE_MATRIX.md`.

## Privacy and security invariants

- Candidate assessment responses exclude answers, explanations, hidden tests and raw snapshots.
- Candidate interviews exclude private feedback, interviewer instructions, security metadata, audit data and unreleased scoring.
- Candidate offers exclude approval notes, internal actors, snapshots and private negotiation material.
- Candidate applications must not expose recruiter notes, match scores, internal reasons, snapshots or actors. The backend projection is broad; frontend must use a strict allowlist.
- Sanitize sensitive responses inside query functions before they enter React Query cache. React Query `select` does not remove the raw cached response.
- Never cache, log or render signed document URLs, tokens, provider IDs, checksums, resume contents, private notes or raw sensitive payloads.
- Generate signed URLs only on user action, open them immediately and discard them.
- Notification `data` is unsafe. Navigate only through known type/id mappings to allowlisted same-origin routes; never trust an arbitrary action URL.
- Documents derive ownership and company scope server-side. Do not accept ownership/company identity from the client.
- Archived or suspicious/infected/quarantined/replaced/failed/deleted files are not generally downloadable.
- Company document event recipients must be active, approved and permitted members.
- Analytics must remain aggregate, admin-only and CSV-injection safe.

## Demo and startup

Use `npm ci` separately in `backend` and `frontend`. Copy `backend/.env.example` to `.env` and `frontend/.env.example` to `.env.local`; never read or commit actual environment files. Run `npm run seed:demo`, backend `npm run dev`, then frontend `npm run dev`. Full portable instructions and all eight seeded accounts are in `HUMAN_SETUP_GUIDE.md`.

## Environment variables

Required backend values: MongoDB URI, exact client URL, two distinct JWT secrets of at least 32 characters, and token lifetimes. Optional groups configure Resend, Cloudinary, upload limits, signed URL TTL and storage quota. Frontend uses `VITE_API_BASE_URL`. Treat credentials as secrets and never include them in output or logs.

## Deployment state

The API validates environment at startup, connects to MongoDB before listening and exposes a health endpoint. This is demo-ready, not production-ready. There is no committed CI/CD, Docker/IaC/hosting configuration, SPA rewrite, worker scheduler, observability, backup/restore, index rollout, smoke, rollback or incident runbook. Production must use HTTPS, exact CORS origins, secure cookie behavior, secret management and operational notification-outbox processing.

## Current blockers and technical debt

1. Admin frontend is mostly placeholders.
2. Recruiter interview details lack authoritative live rounds, scorecard tasks/deadlines and general concurrency contracts.
3. Older frontend hooks may keep raw DTOs in cache because adaptation occurs through `select`.
4. Global mutation retry after 401 is unsafe.
5. No browser E2E, broad device/assistive-technology matrix, coverage thresholds or deployed smoke tests.
6. Organization invitation/search/role/owner-transfer/analytics/export contracts do not exist.
7. Offer capability/version and pagination/filter contracts are incomplete.
8. Document polling/replacement-request/organization repository contracts do not exist.
9. No centralized immutable audit-log model.
10. Feature pages are sometimes monolithic and runtime validation relies on manual mapping rather than response schemas.

## Roadmap

Critical: mutation replay safety, pre-cache DTO sanitization, interview authoritative contracts, admin UI, CI/E2E/deployment/observability/backups. Before Production Beta: capability/version DTOs, safe notification targets, offer/document contract hardening, audit log and accessibility/browser matrix. Future product additions should remain explicitly unsupported until backend contracts and governance are approved.

## Rules for Future AI Agents

1. Never invent endpoints, response fields, database fields, statuses, permissions, roles or workflows.
2. Read the real route, validator, controller, service, serializer and model before implementing UI.
3. Never add `owner` to the global account-role system. Organization Owner comes from membership.
4. UI gating is not authorization. Treat API `401`, `403`, `404`, and `409` as authoritative.
5. Never trust JWT authorization claims alone for organization access.
6. Never expose recruiter-private data to candidates or candidate-private data across candidates/organizations.
7. Never expose approval notes, internal feedback, hidden assessment material, private interview content, audit actors or sensitive snapshots.
8. Never log or persist signed URLs, tokens, secrets, document content, provider metadata or private notes.
9. Sanitize sensitive DTOs before query caching, not only during rendering.
10. Never automatically repeat a consequential mutation after reauthentication.
11. Use immutable assignment/offer/application snapshots as defined by backend services; do not reconstruct them client-side.
12. Use server-provided upload constraints; do not hardcode file limits when an upload session provides them.
13. Do not simulate unsupported AI, e-signature, billing, calendar/video, invitation, analytics or security controls. Render a clear unavailable state and document the blocker.
14. Preserve native semantics, keyboard access, visible focus, reduced motion and 44×44 interactive targets.
15. Keep `/me`, `/manage`, and `/admin` routes before dynamic identifiers.
16. Publish domain events from services, not controllers. Optional notification failure must not reverse completed mutations.
17. Never execute candidate code in-process.
18. Never delete a provider asset while another retained Document references the same provider ID.
19. Do not inspect or print `.env`; use `.env.example` only.
20. Preserve unrelated dirty work. Use `apply_patch` for intentional edits.
21. Run only the verification commands the user authorizes. Documentation-only audits must not run tests/build/lint/typecheck/format/audit.
22. Update `AI.md`, `PROJECT_PROGRESS_REPORT.md`, `FEATURE_MATRIX.md`, and `API_AND_ROUTE_MAP.md` after major contract or product phases.
23. Record limitations and failed evaluations honestly. Never claim a phase complete without evidence.
24. Treat historical Phase 0 frontend documents as provenance where they conflict with current code.

