# Talvix

Talvix is an evidence-based hiring platform designed to support structured,
auditable hiring decisions.

## Repository structure

- `frontend/` is the boundary reserved for the React client.
- `backend/` contains the production-oriented Node.js/Express modular monolith.
- `docs/` contains architecture decisions, API documentation, and operational
  guides that apply across the system.

The AI service and deployment configuration remain outside the current scope.

## Current status

The backend implements authentication, profiles, companies and jobs, ATS,
assessments, interviews, offers, persisted notifications, and entity-scoped
document management with signed private delivery, profile/company
synchronization, immutable assessment attachment rules, MongoDB-backed
distributed storage reservations, application evidence verification, and
workflow attachments.
See `backend/README.md` for endpoints, policies, setup, and verification.

Hardening covers interview/offer attachment access, filtered document events,
database singleton indexes, and concurrent profile/logo replacement.
Interview attachments support transaction-safe replacement. Provider cleanup
persists retry state and rechecks references before deletion.

The backend now includes admin-only platform analytics for every major domain,
UTC time series, funnel reporting, safe health indicators, and aggregate
JSON/CSV exports. No frontend dashboard or external BI system is included.
