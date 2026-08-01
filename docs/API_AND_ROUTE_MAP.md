# Talvix API and Frontend Route Map

All APIs are under `/api/v1`. This is a route-family map; validators in `backend/src/validators/` are the exact request contract and controllers/services are authoritative.

| API family | Principal routes | Access | Frontend coverage |
| --- | --- | --- | --- |
| Health | `GET /health` | Public | Operational check only |
| Auth | `POST /auth/register|login|logout|refresh`, `GET /auth/me`, `PATCH /auth/profile` | Public/authenticated | `/login`, `/register`, session restoration and account settings |
| Candidates | `/candidates/me`, collection CRUD; recruiter/admin search/detail | Candidate owner or reviewer | `/candidate/profile`; recruiter ATS candidate views |
| Recruiters | `/recruiters/me`; `/recruiters/admin/pending`, approve/reject/suspend | Recruiter/Admin | Recruiter identity in shell; admin UI missing |
| Companies | create, `/companies/me`, team add/update/remove; public discovery; admin verification | Public/Recruiter/Admin | `/org/company`, `/org/settings`, `/org/team`; admin UI missing |
| Jobs | public list/detail; recruiter create/manage/lifecycle; admin review/feature | Public/permission/Admin | `/candidate/jobs`; `/org/jobs`; admin UI missing |
| Applications | candidate submit/me/timeline/withdraw/snapshot; recruiter manage/pipeline; admin correction | Candidate/permission/Admin | Candidate applications and recruiter ATS; admin UI missing |
| Assessments | questions, definitions, assignments, attempts, reviews, admin corrections | Candidate/permissions/Admin | Candidate and recruiter assessment workspaces |
| Interviews | templates, processes, rounds, schedules, feedback, availability, candidate `me`, analytics/admin | Candidate/permissions/Admin | Candidate flows and partial recruiter management |
| Offers | templates, manage, approvals, analytics, candidate `me`, admin corrections | Candidate/permissions/Admin | Recruiter and candidate offer workspaces |
| Documents | generic owner, upload sessions, profile/company/application/assessment/interview/offer integrations, verification/admin | Owner/permissions/Admin | Candidate manager, contextual attachments, recruiter verification |
| Notifications | owned inbox/preferences/bulk; admin templates/outbox/email logs | Authenticated owner/Admin | Candidate center; recruiter/admin product UI incomplete |
| Admin analytics | overview plus domain reports, health and export | Admin | No finished analytics UI |

## Frontend route families

| Layout | Routes | State |
| --- | --- | --- |
| Public/Auth | `/`, `/login`, `/register`, `/session-expired`, `/unauthorized`, `/forbidden`, `*` | Implemented |
| Candidate | `/candidate`, `/candidate/profile`, `/candidate/jobs/*`, `/candidate/applications/*`, `/candidate/assessments/*`, `/candidate/interviews/*`, `/candidate/offers/*`, `/candidate/documents/*`, `/candidate/notifications/*`, `/candidate/settings/*` | Broadly implemented; see feature matrix |
| Organization | `/org`, `/org/jobs/*`, `/org/applications/*`, `/org/candidates/*`, `/org/assessments/*`, `/org/interviews/*`, `/org/offers/*`, `/org/documents/*`, `/org/company/*`, `/org/team/*`, `/org/settings` | Broadly implemented; interviews partial |
| Unsupported organization capabilities | `/org/invitations`, `/org/analytics`, `/org/exports` | Honest unavailable states |
| Admin | `/admin` and administration children | Protected shell, mostly placeholders |

## Authorization model

- Global account roles are only `candidate`, `recruiter`, and `admin`.
- Organization Owner is not an account role; it is a privileged company membership.
- Recruiter authorization reloads the active recruiter profile, active company, active embedded membership and permission intersection from MongoDB.
- Permissions: `company.manage`; job create/update/delete/publish; application view/manage; assessment view/manage/assign/review; interview view/manage/schedule/evaluate; offer view/manage/approve/send; `team.manage`; document view/manage/verify.
- Frontend route/navigation gating is presentation only. API `401`, `403`, `404`, and `409` responses remain authoritative.
- Static `/me`, `/manage`, and `/admin` routes must stay before dynamic identifiers.

## Important contract gaps

- No organization invitation/search/custom-role/owner-transfer/analytics/export APIs.
- No authoritative managed interview live-round/scorecard task/deadline DTO or general concurrency token.
- No server-safe notification navigation target DTO.
- No document processing polling, organization repository or replacement-request action.
- No offer capability/version DTO; candidate offer and approval pagination are incomplete.
- No password reset/change, MFA, device/session list, login history or account deletion.

