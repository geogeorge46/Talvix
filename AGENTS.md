# Repository Guidelines

## Structure and architecture

Talvix is one repository: `frontend/` holds the future React client,
`backend/` holds the Express modular monolith, and `docs/` holds cross-cutting
decisions. Backend requests flow through routes, authentication/authorization,
strict Zod validation, controllers, services, and Mongoose models. Controllers
translate HTTP; services own business rules and persistence. Reuse shared
errors, pagination, permissions, snapshots, status utilities, serializers, and
the persisted notification outbox.

The backend includes authentication, profiles, companies, jobs, ATS,
assessments, interviews, offers, notifications, and document delivery. Workers,
frontend features, and AI are out of scope.

## Commands and style

Run backend commands from `backend/`: `npm run dev`, `npm start`, `npm run
lint`, and `npm test`. Run one suite with `npx vitest run test/<file>.test.js`.
Use ES modules, async/await, centralized errors, and strict schemas. Company
access must reload approval, active membership, verification, and permissions
from MongoDB; never trust JWT authorization claims alone.

## Testing

Integration tests use Vitest, Supertest, and isolated
`mongodb-memory-server` replica sets. Exercise transactions, concurrency,
ownership, permissions, privacy, idempotency, and failure cleanup. Declare
static `/manage`, `/admin`, and `/me` routes before dynamic identifiers. Never
make real Cloudinary or Resend calls in automated tests.

## Security and documents

Never read, print, or commit `.env`; use only `.env.example`. Candidate
assessment responses must exclude answers, explanations, hidden tests, and raw
snapshots. Candidate interview views exclude private feedback, instructions,
security details, and audit data. Candidate offer views exclude approval data,
snapshots, internal actors, and corrections. Never execute candidate code
in-process.

Publish allowlisted events from services, not controllers. Keep credentials,
private notes, provider metadata, checksums, and signed URLs out of payloads and
logs. Document events target only active, approved, permitted company members;
optional notification failure must not reverse document mutations.
Cleanup retries recheck retained references before provider deletion;
quarantine wording must reflect stored scan state.
Analytics stay aggregate, admin-only, UTC-bounded, and privacy-safe. Funnel
counts represent stages ever reached; exports must prevent CSV injection.

Document routes derive ownership and company scope server-side. Assessment
attachment rules come only from immutable assignment snapshots. Uploads require
transaction-capable MongoDB: atomically reserve quota, synchronize Documents
and entity references, and release reservations/provider assets on failure.
Never delete an asset while another retained Document references its provider
ID. Archived personal files remain owner-only; suspicious, infected,
quarantined, replaced, failed, and deleted files are not downloadable.
