# Talvix local testing guide

## Demo accounts

Talvix does not automatically create a default administrator during application startup. Running the development-only demo seed creates the following accounts in a clean local database:

| Role | Email | Password | Login URL |
| --- | --- | --- | --- |
| Admin | `admin@talvix.local` | `Admin@12345` | `http://localhost:5173/login` |
| Approved recruiter | `recruiter@talvix.local` | `Recruiter@12345` | `http://localhost:5173/login` |
| Candidate | `candidate@talvix.local` | `Candidate@12345` | `http://localhost:5173/login` |
| Pending recruiter | `recruiter-pending@talvix.local` | `Recruiter@12345` | `http://localhost:5173/login` |

The seed creates users through the existing `User` model, whose save hook uses the application bcrypt work factor. It never prints hashes. It refuses to run in production and refuses to overwrite a matching account whose role or password differs from the reserved demo definition.

## Seeded data

- One admin, one approved recruiter, one pending recruiter and five candidates (five candidates are needed for five distinct application stages).
- One verified company and one pending company.
- Three jobs: published, pending review and draft.
- Five applications: submitted, under review, assessment pending, interview scheduled and offer sent.
- In-app notifications.
- A published assessment and available assignment.
- A scheduled interview process/round.
- A sent offer.

`npm run seed:demo` is idempotent: it does not drop the database or delete records. Repeated execution reuses the demo fixtures instead of duplicating them.

## Environment

### Required backend variables

| Variable | Local requirement |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string; a replica set is required for transaction-backed upload workflows. |
| `CLIENT_URL` | `http://localhost:5173` |
| `JWT_ACCESS_SECRET` | Unique random value of at least 32 characters. |
| `JWT_REFRESH_SECRET` | Different unique random value of at least 32 characters. |
| `JWT_ACCESS_EXPIRES_IN` | For example `15m`. |
| `JWT_REFRESH_EXPIRES_IN` | For example `7d`. |

`NODE_ENV`, `PORT`, and `APP_FRONTEND_URL` have development defaults in the example, but should remain explicit locally.

### Optional or conditionally required backend variables

- Email: `EMAIL_PROVIDER`, `EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO`, `EMAIL_MAX_ATTEMPTS`.
- File storage: `FILE_STORAGE_PROVIDER`, `FILE_UPLOADS_ENABLED`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- File limits: `FILE_MAX_IMAGE_MB`, `FILE_MAX_DOCUMENT_MB`, `FILE_MAX_ASSESSMENT_ATTACHMENT_MB`, `FILE_SIGNED_URL_TTL_SECONDS`, `FILE_MAX_USER_STORAGE_MB`.

For basic local testing, keep email and uploads disabled:

```dotenv
EMAIL_PROVIDER=disabled
EMAIL_ENABLED=false
FILE_STORAGE_PROVIDER=disabled
FILE_UPLOADS_ENABLED=false
```

Cloudinary credentials are needed only when Cloudinary uploads are explicitly enabled. `RESEND_API_KEY` is needed only when enabled email uses Resend.

### Frontend variable

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

The committed examples intentionally leave `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` blank. Those are the missing values in a clean checkout. Existing uncommitted `.env` files are not inspected because they may contain secrets.

## Clean-terminal commands

### Backend

```powershell
cd "C:\Users\ASUS\Downloads\s9 project\TALVIX\backend"
npm install
Copy-Item .env.example .env
```

Edit only the new uncommitted `.env`; set `MONGODB_URI` and two different random JWT secrets of at least 32 characters. Then run:

```powershell
npm run seed:demo
npm run dev
```

Expected URLs:

- Backend: `http://localhost:5000`
- Health check: `http://localhost:5000/api/v1/health`

### Frontend

In a second terminal:

```powershell
cd "C:\Users\ASUS\Downloads\s9 project\TALVIX\frontend"
npm install
Copy-Item .env.example .env.local
npm run dev
```

Expected frontend: `http://localhost:5173`

## Role-based testing checklist

### Admin

- [ ] Sign in with the seeded admin account.
- [ ] Confirm the admin shell loads; note that the current dashboard is a placeholder.
- [ ] Test recruiter approval/rejection through the API; the product page is not yet built.
- [ ] Test company verification/suspension/rejection through the API.
- [ ] Test job approval/rejection through the API.
- [ ] Test application, assessment, interview, offer and document administration through their admin APIs.
- [ ] Test notification administration and aggregate analytics/export APIs.
- [ ] Verify recruiter/candidate routes reject the admin role.

### Recruiter

- [ ] Sign in with the approved recruiter.
- [ ] Confirm the verified Talvix Labs workspace and dashboard load.
- [ ] Confirm the pending recruiter is blocked from verified-company workflows.
- [ ] Inspect company/team APIs; current product pages are incomplete.
- [ ] Create and edit a job, submit it for review, and exercise supported lifecycle actions.
- [ ] View candidates and applications; filter, sort and paginate.
- [ ] Move an application through an allowed stage and test stale/conflict recovery.
- [ ] Create/manage an assessment and assign it to an eligible candidate.
- [ ] Inspect assessment assignment and review workflows.
- [ ] Inspect interview processes and templates; note the documented live-round backend limitation.
- [ ] Test offer creation/approval/send and analytics through APIs; product pages remain incomplete.
- [ ] Test document verification and analytics through APIs where frontend pages are incomplete.

### Candidate

- [ ] Sign in with the seeded candidate.
- [ ] Test candidate profile completion through the API; the product profile page is a placeholder.
- [ ] Test resume/document upload only after enabling a supported storage provider.
- [ ] Browse published jobs and apply through the API; candidate job pages are not complete.
- [ ] View application status through the API; candidate application pages are placeholders.
- [ ] Open an assigned assessment, save answers, recover from a failed save and submit once.
- [ ] Verify expired assessment actions are disabled.
- [ ] View interview details, availability and schedule response flows.
- [ ] View/respond to an offer through the API; candidate offer page is not complete.
- [ ] View notifications through the API; notification UI is a placeholder.

### Technical

- [ ] Loading, empty, filtered-empty, partial-error and full-error states.
- [ ] Permission denied, pending approval, unverified company and suspended states.
- [ ] Pagination, filters, sorting and URL-state restoration.
- [ ] Desktop and narrow/mobile layouts.
- [ ] Keyboard-only navigation and visible focus.
- [ ] Form validation and mapped server errors.
- [ ] Refresh-cookie session restoration and access-token refresh.
- [ ] Wrong-role and unauthenticated route access.
- [ ] `400`, `401`, `403`, `404`, `409`, `422` and `5xx` API handling.
- [ ] Duplicate job/application/assessment/submit mutations.
- [ ] Candidate privacy: no private notes, answers, hidden tests, interview feedback or approval data.
- [ ] Re-run `npm run seed:demo` and confirm no duplicates are created.

