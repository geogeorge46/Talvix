# Talvix Feature Matrix

Legend: **Complete** = supported end to end; **Partial** = useful but incomplete; **Backend** = API exists without complete product UI; **Frontend** = UI boundary exists but capability is unavailable; **Unsupported** = no approved contract.

## Candidate

| Feature | Classification | Notes |
| --- | --- | --- |
| Dashboard and deadlines | Partial | Bounded aggregation; no dedicated dashboard endpoint. |
| Profile and visibility | Partial | Main fields and collection CRUD; photo/basic-account polish remains. |
| Skills, experience, education, projects, certifications | Partial | Supported CRUD present; optional-field/edit behavior needs broader verification. |
| Job discovery/detail/apply | Complete | Server filters, pagination and question-aware application; no recommendations/bookmarks. |
| Applications/timeline/withdraw | Complete | Strict frontend privacy allowlist; backend serializer hardening recommended. |
| Assessments | Partial | Full core attempt flow; no production code execution/proctoring. |
| Interviews | Partial | List/detail/availability/response; private feedback excluded. |
| Offers | Partial | List/detail/timeline/respond/attachments; pagination contract mismatch. |
| Documents | Partial | Owner manager and contextual documents; no processing polling. |
| Notifications/preferences | Partial | Owned center and bulk actions; server-safe target DTO absent. |
| Password/MFA/devices/account deletion | Unsupported | Logout/refresh are the only security-session controls. |

## Recruiter

| Feature | Classification | Notes |
| --- | --- | --- |
| Hiring overview | Partial | Real bounded metrics; AI unavailable. |
| Jobs | Complete | Draft/edit/review submission/lifecycle. Admin approval UI absent. |
| ATS, candidates and pipeline | Complete | Board plus accessible list and explicit stage movement. |
| Assessments | Partial | Definitions, questions, assignments and review; browser depth remains. |
| Interviews | Partial | Templates/process/feedback plus scheduling boundaries; live-round/task DTO blockers. |
| Offers | Partial | Templates, approvals, revisions, lifecycle and attachments; capability/pagination gaps. |
| Company profile/team/permissions | Partial | No invitations, recruiter search, custom roles or owner transfer. |
| Documents | Partial | Contextual verification hub, not an organization repository. |
| Notifications | Backend | Global trigger exists; recruiter inbox product page is not complete. |
| Organization analytics/export | Frontend | Explicit unavailable state; no organization-scoped API. |

## Admin

| Feature | Classification | Notes |
| --- | --- | --- |
| Recruiter/company/job review | Backend | APIs exist; product pages are placeholders. |
| Application/assessment/interview/offer/document administration | Backend | Corrective and inspection APIs exist; UI absent. |
| Notification/outbox/template administration | Backend | Full API family; UI absent. |
| Platform analytics and JSON/CSV export | Backend | Aggregate, privacy-safe APIs; reporting UI absent. |
| Admin dashboard/users/companies | Partial | Protected shell/routes exist, mostly placeholders. |

## Shared platform

| Feature | Classification | Notes |
| --- | --- | --- |
| Authentication and refresh | Partial | Core complete; recovery/MFA/session management unsupported. |
| RBAC and company membership | Complete | Server reloads membership and permissions; owner is membership-derived. |
| Design system/shell/routing | Complete | Strong foundation; browser/AT verification remains. |
| Notification outbox/email | Partial | Persisted outbox; email optional and disabled by default. |
| Private document storage | Partial | Cloudinary optional; no real malware engine or polling. |
| Admin analytics/export | Backend | Aggregate only, UTC bounded and CSV-injection protected. |
| AI matching/evaluation | Unsupported | Deterministic skill match only; no AI service. |
| Billing/e-signature/calendar/video | Unsupported | Metadata-only meeting links; no provider workflows. |
| CI/CD and production hosting | Unsupported | No checked-in pipeline or deployment configuration. |
