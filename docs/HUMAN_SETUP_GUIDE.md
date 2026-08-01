# Talvix Human Setup Guide

## Prerequisites

- Git
- Node.js **22.12+** recommended (frontend requires Node 20.19+ or 22.12+; backend documents Node 20+)
- npm and two terminal windows
- MongoDB Atlas or a transaction-capable local MongoDB replica set

Use `npm ci` for reproducible installation because both projects commit lockfiles.

## Repository layout

- `backend/`: Express/Mongoose API and seed scripts
- `frontend/`: React/Vite application
- `docs/`: product, design-system, audit and operational documentation

## Environment

Never inspect, print, or commit `.env` files. Copy only the examples.

Backend required values in `backend/.env`: `MONGODB_URI`, `CLIENT_URL=http://localhost:5173`, distinct random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values of at least 32 characters, and token lifetimes. Keep email/uploads disabled for basic local work. See `backend/.env.example` for every optional Cloudinary, Resend, file-limit and URL setting.

Frontend `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

## MongoDB Atlas

1. Create a project and M0+ cluster.
2. Create a least-privilege database user; do not reuse the Atlas account password.
3. Add only your current IP under Network Access. Avoid `0.0.0.0/0` outside disposable development.
4. Copy the driver connection string, URL-encode password special characters, choose a development database name, and set `MONGODB_URI` locally.
5. Atlas is transaction-capable. A local standalone MongoDB is insufficient for transaction-backed upload/reservation workflows; configure a replica set.

## Install and start

### Windows PowerShell

```powershell
cd "path\to\TALVIX\backend"
npm ci
Copy-Item .env.example .env
# edit .env, then:
npm run seed:demo
npm run dev
```

Second terminal:

```powershell
cd "path\to\TALVIX\frontend"
npm ci
Copy-Item .env.example .env.local
npm run dev
```

### Linux or macOS

```bash
cd /path/to/TALVIX/backend
npm ci
cp .env.example .env
# edit .env
npm run seed:demo
npm run dev
```

Second terminal:

```bash
cd /path/to/TALVIX/frontend
npm ci
cp .env.example .env.local
npm run dev
```

Expected URLs: frontend `http://localhost:5173`, backend `http://localhost:5000`, health `http://localhost:5000/api/v1/health`.

## Demo accounts

All demo passwords are local-only. The seed refuses production and is idempotent.

| Account | Password | Seed purpose |
| --- | --- | --- |
| `admin@talvix.local` | `Admin@12345` | Admin APIs/shell |
| `recruiter@talvix.local` | `Recruiter@12345` | Approved recruiter and verified company |
| `recruiter-pending@talvix.local` | `Recruiter@12345` | Approval-blocked state |
| `candidate@talvix.local` | `Candidate@12345` | Submitted application |
| `candidate2@talvix.local` | `Candidate@12345` | Under-review application |
| `candidate3@talvix.local` | `Candidate@12345` | Assessment assignment |
| `candidate4@talvix.local` | `Candidate@12345` | Scheduled interview |
| `candidate5@talvix.local` | `Candidate@12345` | Sent offer |

The seed creates representative states directly; it is not proof that every transition was exercised end to end.

## Role testing

- Candidate: dashboard/profile, jobs/apply, owned application timeline, assessment, interview, offer, documents, notifications, logout and wrong-role denial.
- Recruiter: verified workspace, jobs, ATS, assessment, partial interviews, offers/documents, company/team permissions and stale `403/409` handling.
- Admin: use APIs for approval, correction, notification administration and analytics; most admin product pages remain placeholders.

## Troubleshooting

- `ECONNREFUSED`/startup failure: verify MongoDB reachability, credentials, IP allowlist and TLS.
- Transaction error: use Atlas or a local replica set, not standalone MongoDB.
- CORS/cookie failure: `CLIENT_URL` must exactly match the frontend origin; production requires HTTPS for the secure refresh cookie.
- Port occupied: stop the existing process or change backend `PORT`; keep frontend API URL synchronized.
- Upload unavailable: expected when `FILE_UPLOADS_ENABLED=false`; configure Cloudinary only when explicitly testing storage.
- Email unavailable: expected with disabled provider; never use real Resend calls in automated tests.
- Seed conflict: the seed will not overwrite reserved accounts with conflicting roles/passwords. Use a clean development database rather than editing production-like data.
- Deep-link 404 after deployment: configure the static host to rewrite SPA routes to `index.html`.

There is no destructive reset script. To reset demo data, use a dedicated disposable development database and drop that database through MongoDB tooling only after verifying the exact target.
