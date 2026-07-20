# Talvix frontend route and permission matrix

## Principles

The frontend proposes routes; the API remains authoritative. The only identity roles are `candidate`, `recruiter`, and `admin`. Owner capabilities are recruiter membership capabilities and never a fourth role. Navigation is hidden only after capability loading; direct URLs run the same guard chain.

## Proposed route tree

| Frontend route | Actor / exact permission | Preconditions and data | Denied/fallback | Responsive priority | Phase |
| --- | --- | --- | --- | --- | --- |
| `/`, `/jobs`, `/jobs/:jobId`, `/companies`, `/companies/:companyId` | Public | Public jobs/companies | Public 404; preserve filters | P0 | 2 |
| `/login`, `/register`, `/session-expired` | Anonymous/session | Auth endpoints | Authenticated role redirect | P0 | 1 |
| `/candidate`, `/candidate/profile` | Candidate | `/auth/me`, `/candidates/me` | Role home/403; missing profile recovery | P0 | 1–2 |
| `/candidate/documents` | Candidate owner | `/candidates/me`; `/documents/me/resume`, `/documents/me/profile-photo`; owned generic document list/download | Session/role denial; safe unavailable state; only server-downloadable document states expose download | P1; stacked document list and full-width actions on narrow screens | 2 |
| `/candidate/applications`, `/candidate/applications/:id` | Candidate owner | Own applications/timeline | Safe 404/unavailable | P0 | 3 |
| `/candidate/assessments`, `/candidate/assessments/:assignmentId`, `/candidate/attempts/:attemptId` | Candidate owner | Assignment/attempt/deadline | Safe 404; expired/submitted state | P0 | 4 |
| `/candidate/interviews`, `/candidate/interviews/:processId` | Candidate owner | Process list/detail via `/interviews/me[/:processId]` | Safe 404; response state | P0 | 5 |
| `/candidate/interview-schedules/:scheduleId` | Candidate owner | Schedule detail/respond via `/interviews/me/schedules/:scheduleId` | Safe 404; response state | P0 | 5 |
| `/candidate/offers`, `/candidate/offers/:offerId` | Candidate owner | Candidate-safe offer/timeline | Safe 404; expired/superseded state | P0 | 5 |
| `/notifications`, `/settings/notifications` | Any authenticated user | Inbox/preferences | Session-expired | P1 | 6 |
| `/org` | Recruiter; at least one visible org capability | Approved profile, active membership/company; dashboard aggregate is **Gap** | Onboarding/pending/rejected/suspended state | P0 | 1 shell; data later |
| `/org/profile` | Recruiter self; no company permission | `/auth/me`, `GET/PATCH /recruiters/me`; approval state | Session/role denial; unapproved/rejected/suspended recruiter sees the appropriate onboarding/status variant, not org data | P0; single-column form on narrow screens | 2 (alias exists in Phase 1) |
| `/org/jobs` | Recruiter `jobs.update` | Active membership/company | Permission denied | P0 | 2 |
| `/org/jobs/new` | `jobs.create` | Active membership/company | Disable/hide; denied route | P0 | 2 |
| `/org/jobs/:id` | `jobs.update`; actions additionally `jobs.delete`/`jobs.publish` | Scoped managed job | Safe 404; 409 reconcile | P0 | 2 |
| `/org/applications`, `/org/applications/:id` | `applications.view`; mutations `applications.manage` | Approved + active membership + verified active company | Verification gate/denied | P0 | 3 |
| `/org/assessments`, `/org/assessments/:id` | `assessments.view`; edit `manage`, assign `assign`, review routes `review` | Verified company | Verification/permission state | P0 | 4 |
| `/org/assessments/reviews/:attemptId` | `assessments.review` | Scoped pending/reopened review | Safe 404/denied | P0 | 4 |
| `/org/interviews`, `/org/interviews/:processId` | `interviews.view`; actions `manage/schedule/evaluate` | Verified company | Verification/permission state | P0 | 5 |
| `/org/offers`, `/org/offers/:offerId` | `offers.view`; actions `manage/approve/send` | Verified company | Verification/permission state | P0 | 5 |
| `/org/offers/approvals/:offerId` | `offers.approve` | Scoped approval detail | Safe 404/denied | P0 | 5 |
| `/org/documents`, `/org/documents/verification/:documentId` | `documents.view`; verification `documents.verify`; mutations `documents.manage` plus domain permission where API requires | Verified company for protected workflow domains | Safe metadata/denied | P1 | 5–6 |
| `/org/company` | `company.manage` for edit; read from `/companies/me` | Approved recruiter, active membership/company | Onboarding or denied edit | P1 | 5 |
| `/org/team` | `team.manage` | Active company membership; usually owner-capability | Denied; never owner-role redirect | P1 | 5 |
| `/admin` | Admin | Admin analytics overview | Role home/403 | P0 | 6 |
| `/admin/recruiters`, `/admin/companies`, `/admin/jobs` | Admin | Pending queues/actions | Admin-only denial | P0 | 6 |
| `/admin/jobs/:jobId`, `/admin/reviews/:id` | Admin | Notification targets; review resolver/queue fallback | Admin-only denial/safe unavailable | P0 | 6 |
| `/admin/applications`, `/admin/assessments`, `/admin/interviews`, `/admin/offers` | Admin | Domain corrective endpoints | Admin-only denial | P1 | 6 |
| `/admin/documents`, `/admin/notifications`, `/admin/analytics` | Admin | Oversight/ops/aggregate endpoints | Admin-only denial | P1 | 6 |
| `/forbidden`, `/not-found`, `/maintenance` | System | Router/API state | Stable recovery links | P0 | 1 |

## Recruiter permission matrix and navigation

| Permission | UI capabilities | Navigation rule |
| --- | --- | --- |
| `company.manage` | Edit company profile | Show Company edit entry; company status remains viewable without implying edit. |
| `jobs.create` | Create job | Show Create job action. |
| `jobs.update` | Read/edit managed jobs | Show Jobs; this is the current managed-read permission. |
| `jobs.delete` | Delete eligible job | Show destructive action only in eligible status. |
| `jobs.publish` | Submit/publish/pause/resume/close | Show lifecycle actions based on server state. |
| `applications.view` / `applications.manage` | Pipeline/detail / status, notes, rating, tags, assignees | Show Applications on `view`; mutation controls on `manage`. |
| `assessments.view` / `manage` / `assign` / `review` | Browse/statistics / definitions/questions / assignments / scoring-release | Show section on any relevant view path; gate each action exactly. |
| `interviews.view` / `manage` / `schedule` / `evaluate` | Browse/calendar / processes/templates / schedules/availability / feedback/round execution | One section with capability-filtered subnav/actions. |
| `offers.view` / `manage` / `approve` / `send` | Browse/analytics / draft-workflow / approvals / send | Approvals badge only with `approve`; send action only with `send`. |
| `team.manage` | Add/update/remove members and permissions | Show Team. This capability may indicate owner-like responsibility but is not a role. |
| `documents.view` / `manage` / `verify` | Safe documents / uploads/access / evidence verification | Also require paired domain permissions where endpoint declares them. |

Navigation is built from a single typed model shared by desktop SideNav and mobile Drawer. An item is pending (not briefly visible) until capability context resolves. A hidden item never substitutes for a route guard.

## Canonical routes and persisted notification aliases

`/org/*` is the **Recommended canonical** recruiter workspace. Existing backend-generated and stored notification URLs are an **Implemented compatibility contract**, so Phase 1 registers guarded, replace-history aliases:

| Alias | Canonical route |
| --- | --- |
| `/recruiter/profile` | `/org/profile` |
| `/recruiter/applications/:applicationId` | `/org/applications/:applicationId` |
| `/recruiter/assessments/reviews/:attemptId` | `/org/assessments/reviews/:attemptId` |
| `/recruiter/interviews/:processId` | `/org/interviews/:processId` |
| `/recruiter/offers/approvals/:offerId` | `/org/offers/approvals/:offerId` |
| `/recruiter/documents/verification/:documentId` | `/org/documents/verification/:documentId` |

Candidate `/candidate/interviews/:id` is a backend ambiguity: reminders store a schedule ID while feedback-release events store a process ID. The compatibility route must attempt authorized schedule lookup first, then authorized process lookup after a safe 404, and redirect to the distinct canonical schedule/process route. It must never infer ID type from client state. `/admin/reviews/:id` and `/admin/jobs/:jobId` remain guarded compatibility targets. See [`API_UI_MAPPING.md`](API_UI_MAPPING.md) for the complete action URL table. Aliases may be removed only after coordinated backend path migration and the persisted-notification retention window.

## Guard evaluation order

1. Match public vs authenticated route and preserve a safe internal return path.
2. Resolve/refresh access session (`/auth/me`); on expired access, attempt one credentialed refresh.
3. Confirm exact role.
4. For recruiter routes, load `/recruiters/me` and `/companies/me`; evaluate approval, company existence, company active/verification state and active membership.
5. Evaluate required permission(s), including paired document/domain permissions.
6. Load entity; server enforces ownership/company scope. Do not infer authorization from IDs or cached rows.
7. Render route or the most specific safe state.

The browser’s cached capability result is advisory. Refetch on sign-in, app focus after staleness, role/company/team mutation, 401/403, and before consequential actions if stale. Clear all scoped cache on logout or identity change.

## Error and organization-state behavior

| Condition | UX contract |
| --- | --- |
| `401` | Pause parallel retries, run one refresh; if unsuccessful, clear sensitive state and send to `/session-expired` with safe return route. |
| `403` | Refetch capability context once; show PermissionDenied with role-appropriate home/support path. Do not reveal hidden resource metadata. |
| `404` | Show generic unavailable/not-found; scoped APIs intentionally may conceal existence. |
| `409` | Show “This changed since you opened it,” refetch, compare safe draft and require explicit retry/reconcile. |
| `422`/validation | Field errors plus error summary; focus summary; preserve safe draft. |
| Recruiter unapproved/pending | Onboarding status page; profile/company setup actions only when API permits. |
| Recruiter rejected | Explain status and approved support/appeal route if product defines one; no org workspace. **Decision Required:** appeal policy. |
| Company pending verification | Allow permitted setup/job draft work; verified-domain sections explain verification requirement. Never imply applications/assessment/interview/offer/document access. |
| Company rejected | Read-only reason if safely returned and remediation/support action; no verified workflows. |
| Company suspended/inactive or membership inactive | Immediate cache invalidation, blocking state, no org data remnants; support/logout actions. |

## Direct URL and responsive safety

Deep links must pass guards before feature data renders. Skeletons may show layout only, never cached candidate/private content from another context. On narrow screens, preserve all guard/error actions; priority P0 flows become stacked lists/drawers, tables gain labelled row layouts, pipeline board has a list equivalent, and destructive/consequential actions remain reviewable without horizontal scrolling.
