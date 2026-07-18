# Talvix Backend

The Talvix backend is an Express modular monolith. Infrastructure startup,
Express configuration, routing, middleware, and shared utilities are separate
so future business modules can be tested without coupling them to startup.

## Requirements

- Node.js 20 or newer
- A MongoDB Atlas cluster or compatible local MongoDB instance

## Setup and commands

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` to your connection
   string. Generate different random values of at least 32 characters for
   `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Token lifetimes use values such
   as `15m` and `7d`. `.env` is ignored by Git and must never be committed.
3. Run `npm run dev` for development or `npm start` for a production-style
   start.

Run `npm run lint` to check code quality and `npm test` to run the integration
suite against an isolated in-memory MongoDB replica set.

## API

`GET /api/v1/health` reports whether the HTTP API is running and identifies the
active environment. The server connects to MongoDB before opening its HTTP
port, so startup fails if the database is unavailable.

Authentication is mounted at `/api/v1/auth`:

- `POST /register` creates a candidate or recruiter account.
- `POST /login` authenticates credentials.
- `POST /logout` invalidates and clears the refresh session.
- `POST /refresh` rotates the HTTP-only refresh cookie and access token.
- `GET /me` returns the authenticated user.
- `PATCH /profile` updates validated profile fields.

Send access tokens as `Authorization: Bearer <token>`. Refresh tokens are
managed as HTTP-only cookies and should not be copied into application storage.

Candidate profiles are mounted at `/api/v1/candidates`. Candidate-only
self-service routes provide profile updates and CRUD operations for education,
skills, experience, projects, and certifications. Recruiters and administrators
can retrieve visible profiles and use the paginated search endpoint. All routes
require an access token.

Search accepts `page`, `limit`, `search`, `skills`, `location`,
`preferredRole`, `jobType`, `availability`, `minimumExperience`, and `sort`.
Comma-separate multiple skills. Page size is capped at 50.

Recruiter profiles are mounted at `/api/v1/recruiters`. Public recruiter
registration creates an unapproved profile with no permissions. Administrators
approve, reject, or suspend recruiter accounts through `/admin` routes.

Companies are mounted at `/api/v1/companies`. Approved recruiters can create
one active company, which begins in `pending` verification. The owner is added
as an active team member with owner permissions. Administrators verify, reject,
or suspend companies; public company discovery returns only verified active
companies. Team permissions are always loaded from MongoDB.

Jobs are mounted at `/api/v1/jobs`. Recruiters create drafts for their company,
submit complete jobs for review, and manage published job lifecycle actions.
Only administrators can change `pending-review` jobs to `published`. Public
discovery includes only unexpired published jobs belonging to verified active
companies and hides salary values marked private.

The job state flow is:

```text
draft -> pending-review -> published -> paused -> published
                         -> rejected -> draft
published/paused -> closed -> archived
```

Administrative routes are grouped under `/api/v1/recruiters/admin`,
`/api/v1/companies/admin`, and `/api/v1/jobs/admin`. `/me` and `/manage` routes
are declared before dynamic identifiers to avoid routing conflicts.

Applications and applicant tracking are mounted at `/api/v1/applications` and
have no public routes. Candidates submit to eligible published jobs, list only
their own applications, withdraw, respond to offers, view privacy-limited
timelines, and explicitly refresh early-stage snapshots. Jobs support
`resumeRequired` and `minimumProfileCompletion` eligibility thresholds.

Submission stores detached candidate, resume, and job snapshots, generates a
concurrency-safe `TVX-APP-YYYY-NNNNNN` number, and increments the job counter in
the same transaction. Recruiter routes require persisted `applications.view`
or `applications.manage` permissions and active membership in the application
company. They provide status workflow, private notes, ratings, normalized tags,
trusted assignees, pipeline counts, and job analytics. Admin routes provide
inspection, reason-required corrective transitions, note moderation, and
archival.

Skill match is deterministic. For each weighted job skill, presence contributes
30%, proficiency contributes up to 35%, and experience contributes up to 35%.
Below-target proficiency and experience receive proportional credit; a missing
skill receives zero. The weighted total is normalized to 0–100, with missing
required skills recorded separately.

The recruiter-controlled application flow is:

```text
submitted -> under-review -> shortlisted
shortlisted -> assessment-pending -> assessment-in-progress
assessment-in-progress -> assessment-completed -> shortlisted/interview-scheduled
interview-scheduled -> interview-completed -> offer-pending -> offer-sent -> hired
eligible non-terminal stages -> rejected
```

Candidates may withdraw only from permitted non-terminal stages and may accept
or decline only an `offer-sent` application. Every transition appends history;
admin corrections are explicitly marked as overrides.

## Architecture

- `src/server.js` starts and stops infrastructure.
- `src/app.js` configures Express and global middleware.
- `src/config/` validates configuration and manages MongoDB.
- `src/routes/` defines versioned HTTP endpoints.
- `src/controllers/` translates HTTP requests and responses.
- `src/services/` owns authentication and profile business logic.
- `src/models/` owns Mongoose persistence schemas and password hashing.
- `src/validators/` owns Zod request contracts.
- `src/middleware/` handles missing routes and application errors.
- `src/shared/` contains reusable errors and infrastructure utilities.

## Assessment engine

Private assessment APIs are mounted at `/api/v1/assessments`. Approved
recruiters in a verified, active company use persisted `assessments.view`,
`assessments.manage`, `assessments.assign`, and `assessments.review`
permissions. Candidate and admin endpoints use role and ownership checks.

Question-bank routes use `/questions`; drafts use `/manage`; assignment
management uses `/assignments/manage`; candidate work uses `/assignments/me`
and `/attempts/me`; reviews use `/reviews`; corrective routes use `/admin`.
There is no public assessment endpoint.

Supported questions are single-choice, multiple-choice, true/false,
short-answer, long-answer, and coding. Publishing freezes an assessment and
increments question usage. Assignment stores a detached grading snapshot.
Candidate serializers remove correct answers, accepted answers, explanations,
hidden test expectations, and internal scoring data.

Objective grading awards configured marks for exact answers. Multiple-choice
uses exact-set matching; short answers apply configured trim and case rules.
Negative marking subtracts `negativeMarkValue` per answered incorrect objective
question, capped at its marks. Scores never fall below zero and percentages are
clamped to 0–100. Long answers require review. Coding uses an injected adapter:
the default reports `unavailable` and routes the question to review; the
deterministic adapter is test-only. Submitted code is never executed in-process.

Server time controls expiry. Effective expiry is the earlier of the duration
deadline and assignment expiry. On lazy expiry, attempts with answers are
submitted as `time-expired`; empty attempts become `expired`.

Example question request:

```http
POST /api/v1/assessments/questions
Authorization: Bearer <access-token>
Content-Type: application/json

{"type":"single-choice","title":"Node runtime","prompt":"Which runtime?","difficulty":"easy","defaultMarks":10,"options":[{"id":"node","text":"Node.js"},{"id":"browser","text":"Browser"}],"correctAnswer":{"optionId":"node"}}
```

Create a draft with `POST /api/v1/assessments`, add questions with
`POST /manage/:assessmentId/questions`, publish with
`PATCH /manage/:assessmentId/publish`, then assign with:

```json
{"assessmentId":"<assessment-id>","applicationId":"<application-id>","availableFrom":"2026-08-01T09:00:00.000Z","expiresAt":"2026-08-05T18:00:00.000Z"}
```

Candidates start at `POST /assignments/me/:assignmentId/start`, autosave to
`PATCH /attempts/me/:attemptId/answers`, submit to
`POST /attempts/me/:attemptId/submit`, and fetch a permitted result from
`GET /attempts/me/:attemptId/result`. No new package or environment variable is
required for the built-in execution-unavailable adapter.

## Interview scheduling and evaluation

Private interview APIs are mounted at `/api/v1/interviews`. Recruiters use
persisted `interviews.view`, `interviews.manage`, `interviews.schedule`, and
`interviews.evaluate` permissions in a verified active company. Route groups
cover `/templates`, `/processes`, `/feedback`, `/availability`, `/analytics`,
`/calendar`, candidate `/me`, and corrective `/admin` operations.

Templates freeze ordered rounds and weighted scorecard criteria into each
process. Process creation leaves the application unchanged. The first candidate
acceptance confirms its schedule and advances an eligible application to
`interview-scheduled`; finalization advances it to `interview-completed` without
creating an offer. Schedules store UTC instants plus an IANA display timezone.
Conflicts use `existing.startTime < proposed.endTime` and
`existing.endTime > proposed.startTime` for the candidate and every interviewer.
Rescheduling preserves prior details and increments the schedule version.

Interviewer scores are normalized as `score / maximumScore`, multiplied by the
criterion weight, divided by total weight, and converted to 0–100. Round scores
average submitted interviewer scores. Final process scores average required,
completed rounds. Submitted feedback is immutable unless an administrator
reopens it with a reason. Candidate serializers exclude private notes,
concerns, interviewer instructions, security details, and unreleased feedback.

Example process and schedule requests:

```http
POST /api/v1/interviews/processes
Authorization: Bearer <access-token>
Content-Type: application/json

{"applicationId":"<application-id>","templateId":"<template-id>"}
```

```json
{"interviewerIds":["<recruiter-id>"],"timezone":"Asia/Kolkata","startTime":"2026-08-20T10:00:00.000Z","endTime":"2026-08-20T11:00:00.000Z","mode":"video","meetingProvider":"custom","meetingUrl":"https://meet.example.com/interview"}
```

Meeting links are stored metadata only. No video, calendar OAuth, email, or AI
provider integration is configured, so no dependency or environment change is
required.

## Offer management

Private offer APIs are mounted at `/api/v1/offers`. Recruiters use persisted
`offers.view`, `offers.manage`, `offers.approve`, and `offers.send` permissions.
The module provides templates, company management, approval queues, candidate
portal responses, negotiation, immutable revisions, hiring confirmation,
analytics, timelines, and reason-required admin corrections.

Draft creation stores detached candidate, job, and optional template snapshots,
generates `TVX-OFR-YYYY-NNNNNN` through the shared atomic counter, and moves an
eligible application from `interview-completed` to `offer-pending`. Sending
makes the offer available in the portal and moves the application to
`offer-sent`; candidate acceptance moves it to `offer-accepted`; recruiter
confirmation moves it to `hired`. No email is sent.

Estimated gross compensation is base, variable, bonus, joining bonus, and
allowances normalized into the compensation period. Deductions are recorded but
not subtracted. Currency codes are normalized to uppercase. Revisions use the
same chain and append `-R2`, `-R3`, and so on; the prior revision becomes
`superseded` transactionally.

Example:

```http
POST /api/v1/offers
Authorization: Bearer <recruiter-access-token>
Content-Type: application/json

{"applicationId":"<application-id>","title":"Backend Engineer","employmentType":"full-time","workMode":"remote","joiningDate":"2026-10-01T00:00:00.000Z","compensation":{"currency":"INR","period":"yearly","base":650000,"variable":50000},"validityDays":7}
```

Then request approval at `PATCH /manage/:offerId/request-approval`, approve at
`PATCH /approvals/:offerId/approve`, send at `PATCH /manage/:offerId/send`, and
accept at `PATCH /me/:offerId/accept`. Candidate projections exclude approval
details, internal audit actors, snapshots, and unrelated revisions. No PDF,
signature, payroll, payment, or background-expiry integration is configured.

## Notifications and email

Authenticated inbox APIs are mounted at `/api/v1/notifications`. Users can
filter only their own notifications, retrieve unread counts, change read and
archive state individually or in batches, and manage preferences. Security
notifications remain mandatory. There is no public notification-creation API.

Business services persist `NotificationOutbox` events. The bounded processor
atomically claims pending events, creates deduplicated notifications, attempts
optional email outside the business transaction, and records sanitized delivery
results. Registration enqueues an `account-welcome` event. Admin-only routes
under `/api/v1/notifications/admin` inspect notifications, masked email logs,
and outbox events; process batches; retry or cancel eligible events; and manage
versioned templates.

Email defaults to disabled. Configure the sanitized keys documented in
`.env.example`. Set `EMAIL_ENABLED=true`, `EMAIL_PROVIDER=resend`, and a
`RESEND_API_KEY` to enable Resend; `console` provides safe development output.
Template variables are declared and escaped, and action paths must remain on
the Talvix frontend.

```http
GET /api/v1/notifications?page=1&limit=10&read=false
Authorization: Bearer <access-token>

POST /api/v1/notifications/admin/process-outbox
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{"limit":20}
```

Run `npx vitest run test/notification.integration.test.js` for the focused
notification suite.

Seed missing system templates with `npm run seed:notification-templates`.
The seed creates deterministic version-one in-app and email templates for every
supported notification type and never overwrites an existing version. Delayed
assessment, interview, and offer reminders revalidate current source ownership,
status, version, timestamps, latest-offer revision, and pending response before
delivery. Stale events are retained as cancelled outbox history without a
Notification or provider attempt.

### Workflow events and reminders

`constants/domainEvents.js` is the stable event catalogue. Internal events pass
strict allowlisted payload validation before entering the outbox. Deterministic
keys include the entity and meaningful version or timestamp; the outbox unique
index and per-recipient notification key make publication and processing
idempotent. Optional publication failures do not reverse completed standalone
business operations. Transactional application submission and assessment
assignment persist their event in the same MongoDB session.

Generic application notifications are suppressed for assessment assignment,
interview scheduling, offer sending, and hiring transitions; their specific
module event is authoritative. Delayed reminders are claimed only after
`availableAt`. Assessment cancellation and offer response/expiry cancel pending
reminders. Security delivery remains mandatory; ordinary workflow email follows
user preferences.

| Domain action | Event | Recipients | Channels | Reminder impact |
| --- | --- | --- | --- | --- |
| Application submitted | `application.submitted` | Candidate and authorized recruiters | In-app + preferred email | None |
| Assessment assigned | `assessment.assigned` | Candidate | In-app + preferred email | Creates 24h and 1h reminders |
| Offer sent | `offer.sent` | Candidate | In-app + preferred email | Creates 48h and 24h reminders |
| Offer accepted | `offer.accepted` | Offer creator | In-app + preferred email | Cancels expiry reminders |
| Company suspended | `company.suspended` | Active team | Mandatory high priority | None |
| Interview scheduled | `interview.scheduled` | Candidate and interviewers | In-app + preferred email | Creates 24h and 1h reminders |
| Interview rescheduled | `interview.rescheduled` | Candidate and interviewers | In-app + preferred email | Replaces versioned reminders |
| Assessment submitted | `assessment.submitted` | Authorized recruiters | In-app + preferred email | Cancels expiry reminders |
| Assessment completed | `assessment.completed` | Authorized recruiters | In-app + preferred email | Candidate result remains private |
| Revised offer sent | `offer.revised` | Candidate | In-app + preferred email | Creates revision reminders |
| Offer withdrawn | `offer.withdrawn` | Candidate | In-app + preferred email | Cancels expiry reminders |
| Hiring confirmed | `offer.hire-confirmed` | Candidate and offer managers | In-app + preferred email | Cancels all offer reminders |

Interview, assessment, and offer controllers delegate to workflow integration
services. These decorators commit the underlying business operation first, then
publish optional events, so notification or provider failure cannot reverse the
workflow. Generic application events remain suppressed for module-specific
assessment, interview, offer, and hiring transitions.

## Admin dashboard and platform analytics

Aggregate analytics are mounted at `/api/v1/admin/analytics` and require an
active administrator account. Reports are available for overview, users,
candidates, recruiters, companies, jobs, applications, assessments,
interviews, offers, documents, notifications, and platform health. Candidates
and recruiters receive `403`; inactive accounts receive `401`.

Every report accepts UTC `from`/`to` or a preset: `today`, `yesterday`,
`last-7-days`, `last-30-days`, `last-90-days`, `this-month`, `last-month`,
`this-quarter`, `this-year`, or `all-time`. Custom ranges are limited to five
years. Intervals are hour, day, week, and month; automatic selection uses hour
through 48 hours, day through 90 days, week through one year, then month.
Missing buckets are zero-filled and capped at 2,000.

Application funnel counts mean applications that ever reached each stage,
using current status and unique status-history transitions. Current status is a
separate breakdown. Rates return zero for zero denominators. Growth uses an
equal-length preceding UTC period; a zero baseline becomes zero when unchanged
and 100% when the current value is positive.

`GET /export?report=<type>&format=json|csv` returns bounded aggregate reports in
memory. Report types are allowlisted, filenames are server-generated, CSV cells
are quoted, and formula-leading values are prefixed with an apostrophe. Exports
contain no email, phone, salary, document URL, assessment answer, interview
note, offer term, notification body, or provider identifier.

`GET /health` exposes application-level state only: database readiness, safe
storage mode, backlogs, cleanup/reservation counts, uptime, Node version, and a
coarse memory summary. It never returns configuration values or infrastructure
addresses. Live indexed source collections remain authoritative; snapshots,
Redis, and analytics caching are intentionally omitted at the current scale.
Existing compound indexes cover report filters and date/status scans; no
redundant analytics-only indexes were added. A centralized admin audit-log model
does not yet exist, so exports are authenticated but not persisted as audit
events.

## Documents and file storage

Authenticated document APIs are mounted at `/api/v1/documents`. Every upload
uses a short-lived server-derived session and one memory-buffered multipart
`file`. Entity endpoints derive owner, company, category, access, and entity IDs
server-side. Recruiter company operations require persisted `documents.view`,
`documents.manage`, or `documents.verify` permissions plus approval, active
membership, and an active verified company.

| Scope | Endpoints |
| --- | --- |
| Candidate resume | `POST/GET/DELETE /me/resume`, `POST /me/resume/replace` |
| Candidate photo | `POST/GET/DELETE /me/profile-photo`, `POST /me/profile-photo/replace` |
| Recruiter photo | `POST/GET/DELETE /me/recruiter-profile-photo`, `POST .../replace` |
| Company logo | `POST/GET/DELETE /company/logo`, `POST /company/logo/replace` |
| Applications | `POST/GET /applications/:applicationId`, optional document replacement |
| Assessments | `POST/GET /assessments/attempts/:attemptId`; recruiter views under `/manage` |
| Interviews | Candidate-visible reads under `/interviews`; recruiter management under `/manage/interviews` |
| Offers | Candidate-visible reads under `/offers`; recruiter management under `/manage/offers` |
| Verification | Queue, inspect, approve, and reject under `/manage/verification` |

Candidate and recruiter profiles reference `Document` records for current
photos; candidate profiles also reference the current resume. Companies
reference their current logo. Applications use a resume Document ID snapshot at
submission, so later profile replacement cannot silently change submitted
evidence. Eligible application documents enter `pending` verification
automatically. Candidates see only safe rejection wording; reviewer identity
and private notes remain recruiter-only.

Interview attachments require approved active membership in a verified active
company plus `documents.manage` and `interviews.manage`; reads require both view
permissions. `company-private` files never cross the candidate boundary, while
`candidate-visible` files are limited to the process candidate for active or
completed processes. Credential-like multipart fields are rejected. Authorized
recruiters replace attachments at `POST /manage/interviews/:processId/:documentId/replace`.
Replacement preserves access by default, keeps process/company/category
immutable, and uses transactional one-winner replacement and quota reservation.

| Offer state | Candidate-visible attachment |
| --- | --- |
| `draft`, `pending-approval`, `approved`, `rejected` | Hidden |
| `withdrawn` before first send | Hidden |
| `sent`, `viewed`, `negotiation-requested`, `accepted` | Visible |
| `declined`, `expired`, sent-then-`withdrawn`, `superseded` | Retained and visible |

Company-private approval material remains recruiter-only. Documents remain
linked to their exact offer revision; candidate reads never merge revisions.
Attachment operations never change offer state or immutable revision records.
Hiring is an accepted Offer plus hired Application, not an Offer `hired` state.

Singleton profile assets and logos have partial unique indexes. Replacement
claims the old version, creates the successor, updates the entity reference,
completes the upload session, and commits quota usage in one MongoDB
transaction. A concurrent loser receives a safe conflict; its new provider
asset is removed and its reservation is released. MongoDB replica-set or
sharded transaction support is required for uploads.

Assessment definitions contain an immutable-snapshot attachment policy.
Attachments default to disabled and configure a bounded file count, per-file
and aggregate byte limits, and MIME types selected from the server allowlist.
Attempt uploads enforce the assignment snapshot, candidate ownership, active
attempt/assignment state, expiry, count, and aggregate size. Editing the source
assessment therefore cannot change an existing assignment.

Quota enforcement is distributed. `UserStorageUsage` atomically reserves bytes
with the condition `usedBytes + reservedBytes + request <= quota`; a unique
`StorageReservation` ties that claim to an upload session. Provider upload is
outside the database transaction. Successful document persistence converts the
reservation to used bytes; every provider or transaction failure releases it.
`expireStaleReservations` is an idempotent maintenance entry point. Run
`npm run storage:reconcile` to rebuild retained usage counters without exposing
document metadata. The process-local lock remains only a contention reduction.

Replaced resumes are retained while application references may exist. Replaced
profile photos and logos are deleted after reference updates only when no other
non-deleted Document references the provider/public-ID pair. Final-reference
deletion decrements usage; repeated cleanup is safe. Failures are recorded in
`metadata.providerCleanup` as pending. Every retry rechecks all non-deleted
references immediately before deletion. Provider deletion and a later MongoDB
reference cannot be globally atomic; fresh checks, serialized local cleanup,
safe retention, and idempotency minimize this residual distributed race.
Application, assessment, interview, offer, and verification records retain
their assets with their owning workflow. Provider deletion validates identifiers;
current integrations never reuse provider assets, and private cross-user
deduplication is disabled.

Storage modes are disabled, deterministic memory for tests, and authenticated
Cloudinary. Private files expose only bounded short-lived signed URLs. Mocked
Cloudinary tests cover image/raw options, authenticated access, identifier and
folder safety, normalization, deletion, metadata, signed expiry, and sanitized
errors without network access. Supported images are JPEG, PNG, and WebP;
documents are PDF, DOC, DOCX, and text. Executables, SVG, HTML, scripts, double
extensions, mismatched signatures, macro-enabled formats, and empty files are
rejected.

Events `document.verification-requested`, `document.verified`,
`document.rejected`, and `document.quarantined` use the optional outbox path.
Payloads exclude file contents, URLs, public IDs, checksums, provider metadata,
identity values, and private verifier notes. Notification failure never reverses
the completed document decision.

Verification requests target deduplicated active team members with
`documents.verify`, active accounts, and approved recruiter profiles. Removed,
unapproved/suspended, cross-company, uploader, and admin accounts are excluded.
Decisions notify only the owner and omit reviewer identity and private notes.
Optional publication and outbox failures are sanitized and bounded. Recipient,
publication, template, rendering, persistence, outbox, and email failures cannot
reverse committed document workflows. Retryable failures use bounded backoff;
terminal failures stop at `maxAttempts`. Quarantine wording distinguishes
security review, temporary restriction, and confirmed unsafe status. Repeating
the same scan action is idempotent.

No OCR, AI analysis, malware engine, PDF generation, or electronic signature is
included. Admin scan state is metadata, not a claim that malware was scanned.

Archived personal documents are excluded from default lists but remain
downloadable by their owner. Candidates cannot access archived company-private
documents. Recruiters with `documents.view` may inspect retained company
metadata through entity management policies; quarantined, suspicious,
infected, failed, deleted, and replaced files cannot be downloaded. There is no
raw public or admin download bypass.

For an optional staging-only Cloudinary check, configure Cloudinary explicitly
and run `npm run storage:smoke:cloudinary`. It creates a generated text asset in
`talvix/smoke-tests`, checks metadata and a short-lived signed URL, and always
attempts deletion. It prints no signed URL or credential and is never run by
CI. Automated tests use only memory, disabled, and mocked providers; no real
Cloudinary or Resend request is made.
