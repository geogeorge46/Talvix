# Talvix frontend readiness audit

**Phase:** 0 — planning only  
**Evidence date:** 2026-07-19  
**Status legend:** **Implemented** = verified in repository; **Recommended** = proposed frontend decision; **Future** = outside current API scope; **Decision Required** = approval needed; **Gap** = missing capability or contract.

## Executive verdict

The frontend is **conditionally ready for Phase 1 foundation initialization only**. It is not ready for feature implementation or exact recruiter-dashboard parity. Every core-stack item remains **Decision Required — recommended option (approval pending)** until a frontend-stack ADR approves exact versions and alternatives. Before initialization, also approve deployment, CSP/font delivery, headless primitives, supported browsers and lockfile policy, and place the approved dashboard reference at `../design-reference/talvix-recruiter-dashboard.png`. Aggregate recruiter-dashboard metrics and AI insights are not currently available as a single safe API contract.

No frontend or backend implementation occurred in Phase 0.

## Evidence inspected

| Area | Evidence | Finding |
| --- | --- | --- |
| Repository boundary | [`../../README.md`](../../README.md), [`../../AGENTS.md`](../../AGENTS.md) | React boundary is reserved; backend and security rules are explicit. |
| Frontend | [`../../frontend/README.md`](../../frontend/README.md), complete `frontend/` inventory | **Implemented:** README only. No package manifest, source, routes, TypeScript, Vite, CSS, tests, lint, env, or components. |
| Backend platform | [`../../backend/package.json`](../../backend/package.json), [`../../backend/README.md`](../../backend/README.md), `src/app.js`, `src/server.js`, `src/config/` | Node 20+, Express 5 ESM, Mongoose 9, Zod 4; API mounted at `/api/v1`. |
| API contracts | All files in [`../../backend/src/routes/`](../../backend/src/routes/), `controllers/`, `services/`, `validators/`, `models/` | Auth, profiles, companies, jobs, ATS, assessments, interviews, offers, notifications, documents, and admin analytics are implemented. |
| Authorization | [`../../backend/src/middleware/auth.js`](../../backend/src/middleware/auth.js), `authorizeRoles.js`, `authorizePermissions.js`, `companyAccess.js`, `constants/roles.js`, `constants/permissions.js` | Persisted user, approval, active membership, active/verified company, and intersected permissions are authoritative. |
| Configuration | [`../../backend/.env.example`](../../backend/.env.example) (key names only) | Credentialed single-origin CORS; refresh cookie and provider configuration are backend-only. No secret values were read or recorded. |
| Product | [`../product/TALVIX_PRODUCT_BLUEPRINT.md`](../product/TALVIX_PRODUCT_BLUEPRINT.md) | Product scope and unresolved policy decisions reviewed. |
| Design system | Every file in [`../design-system/`](../design-system/) | Frost Ledger, semantic tokens, responsive shells, evidence patterns, accessibility and phased architecture are source of truth. |
| Visual reference | Expected `../design-reference/talvix-recruiter-dashboard.png`; temporary attachment supplied with task | **Gap:** repository asset is absent. Temporary PNG was accessible for audit only and was not copied. |

## Current frontend inventory

| Capability | Status | Consequence |
| --- | --- | --- |
| React application/package/lockfile | **Gap** | Phase 1 must initialize from zero; backend lockfile does not govern frontend. |
| TypeScript/build/router/data/forms | **Gap** | Exact recommendations are in [`DEPENDENCY_DECISIONS.md`](DEPENDENCY_DECISIONS.md). |
| Tokens/components/shell | **Gap** | Documents define them, but no executable implementation exists. |
| Testing/lint/CI/deployment | **Gap** | Must be established before feature branches. |
| Frontend env contract | **Gap** | Propose only `VITE_API_BASE_URL` and reviewed non-secret flags. |
| API client/DTO adapters | **Gap** | Required to keep candidate-safe projections separate from recruiter/admin views. |

## Backend architecture implications

- Access tokens are bearer tokens; refresh is an HttpOnly cookie set by register/login and rotated by refresh. Keep access tokens in memory only. The cross-origin cookie endpoint allowlist—`POST /auth/register`, `/login`, `/refresh`, and `/logout`—must use `credentials: 'include'`; ordinary bearer-only API calls remain non-credentialed unless the deployment contract changes. Serialize refresh into one in-flight request and never copy the refresh token into JavaScript storage.
- The client may hide navigation for usability, but every direct URL and mutation remains server-authorized. A recruiter JWT is insufficient evidence of company access.
- `candidate`, `recruiter`, and `admin` are the only roles. “Owner” is an active recruiter company membership with the complete permission set—not a fourth role.
- Permission evaluation uses the intersection of recruiter-profile permissions and active membership permissions. Application, assessment, interview, offer, and document permissions also require a verified company.
- Recruiter managed-job reads currently require `jobs.update`, not a nonexistent `jobs.view`; route guards and labels must preserve that fact.
- State transitions are commands, not free-form status edits. The UI must map each action to its dedicated endpoint and treat `409` as stale/concurrent state requiring refetch.
- Public jobs and companies are server-filtered to publishable/verified data. Ownership and company scope for documents are server-derived.

## Approved visual reference

**Availability:** the requested repository path is missing. The task’s temporary image was accessible at audit time, but is not durable evidence and must not be used as a build dependency.

Observed visual contract: a white left sidebar; restrained top bar with search and create action; mineral/off-white canvas; strong “Hiring overview” title; four compact KPI cards; fine neutral borders; small radii; sparse shadows; a horizontal hiring pipeline; dense candidate table; cyan/navy accent panel; compact typography; and Lucide-like outline icons. This supports the design system’s Frost Ledger direction: opaque work surfaces, selective chrome, high density, restrained blue/cyan signals, and evidence-first hierarchy.

The shown “AI Insights” panel is a visual reference, not an implemented capability. Until an AI service, consent/transparency policy, source attribution, uncertainty and correction path are approved, omit it or replace it with clearly labelled deterministic operational insights computed from existing aggregate contracts. Do not imply machine ranking or autonomous hiring judgment.

## Design-system conflict and decision register

| Topic | Evidence/conflict | Resolution for implementation | Status |
| --- | --- | --- | --- |
| Phase numbering | Design plan separates primitives/shell into phases 2–3; current delivery brief calls Phase 1 foundation/toolchain/tokens/auth shell. | This audit’s execution checklist is controlling for delivery; retain design-system acceptance criteria inside the consolidated Phase 1. | **Recommended** |
| Repository reference | Design direction is documented, but the approved PNG is absent. | Copy the approved, versioned asset to the documented path before visual implementation; record checksum in review notes, not client payload. | **Decision Required** |
| AI panel | Visual reference shows AI; architecture marks it Future. | No AI claim in MVP. Use omission or deterministic “Operational insights” only after copy/product approval. | **Gap** |
| Typography | Geist is recommended but not installed; hosting/CSP undecided. | Prefer self-hosted `geist` package assets with audited subsets/fallbacks; approve license/CSP/font-loading strategy. | **Decision Required** |
| Styling | Tailwind is recommended/evaluation language; CSS custom properties are canonical. | Approve Tailwind 4; semantic CSS variables remain source of truth and utilities consume them. | **Decision Required** |
| Headless primitives | Component docs require dialogs/menus/tooltips but no library is chosen. | Approve selective Radix packages, never a wholesale visual kit. | **Decision Required** |
| Naming | `EvidenceRail` is canonical timeline; some domain prose uses timeline/revision rail. | Use EvidenceRail as shared semantic pattern; domain components may wrap it (`OfferRevisionRail`). | **Recommended** |
| Touch target/density | Dense desktop tables conflict with 44px target guidance if copied literally. | Keep compact visual density while hit areas/focus targets reach 44 CSS px where actionable; allow table rows to recompose on narrow screens. | **Recommended** |
| Breakpoints | Design docs define responsive behavior, but browser support and exact product breakpoints require implementation verification. | Tokenize documented breakpoints; validate at 320/375/768/1024/1280/1440 and 200% zoom before freeze. | **Decision Required** |
| Profile completion | Product thresholds and backend per-job `minimumProfileCompletion` coexist. | Display server-returned job threshold; do not hard-code a global eligibility threshold. | **Implemented/Recommended** |
| Status colors | Domain states are numerous; raw backend strings must not map ad hoc to colors. | Create exhaustive domain status adapters to semantic tones and unknown fallback. | **Recommended** |

## API gaps and priorities

| Rank | Gap | Impact | Mitigation/owner |
| --- | --- | --- | --- |
| **Blocker — exact parity** | No recruiter hiring-overview aggregate endpoint combining active jobs, recent applications, weekly interviews, pending offers, pipeline and candidate rows. | Exact approved dashboard would require many calls, inconsistent date windows, and client-side joins. | Backend/product: define aggregate DTO, UTC range semantics, permissions and freshness. Foundation Phase 1 is not blocked. |
| **Blocker — exact parity** | No AI insight/recommendation API or governance contract. | AI panel cannot be truthfully implemented. | Product/security/backend: defer; omit or approve deterministic copy. |
| **Important** | No frontend-oriented contract package/OpenAPI schema or shared generated types. | Manual DTO drift and unsafe projection reuse risk. | Backend/frontend: document response envelopes and fixture contracts; consider OpenAPI separately. |
| **Important** | Auth bootstrap does not provide one explicit consolidated recruiter capability/company-state contract documented for navigation. | Shell may need `/auth/me`, `/recruiters/me`, `/companies/me`; transient inconsistent UI. | Frontend adapter initially; backend may add `/session-context`. Always let server decide. |
| **Important** | Persisted notification `actionUrl` values use `/recruiter/*` while the proposed canonical workspace is `/org/*`; candidate interview links may contain either `scheduleId` or `processId`. | Deep links can 404 or query the wrong identifier type. | Frontend owns a guarded compatibility adapter and aliases in Phase 1; see route matrix. A coordinated backend migration may retire aliases only after stored links expire/migrate. |
| **Important** | Public/company/job search and multiple domain lists use module-specific pagination/query shapes. | Generic tables cannot assume one envelope. | Per-feature adapters and normalized pagination view model. |
| **Important** | Upload limit/capability discovery is configuration-driven but no public capabilities endpoint is evident. | Client cannot reliably announce exact server limits before upload. | Backend: expose sanitized upload capabilities, or treat client hints as non-authoritative and handle `413/422`. |
| **Important** | No idempotency-key contract is evident for most critical mutations. | Retry/double-submit risk. | Disable repeat actions, preserve mutation IDs locally, refetch; backend decision for idempotency. |
| **Later** | Calendar/video OAuth, PDF/e-signature, OCR, GitHub, chat, billing, centralized audit log. | Product parity beyond implemented backend is impossible. | Keep Future and outside current navigation. |

## Risk register

| Area | Risk | Mitigation | Owner |
| --- | --- | --- | --- |
| Security | XSS could expose in-memory access token; cookie refresh can introduce CSRF/CORS mistakes. | Strict CSP, no unsafe HTML, short-lived memory token, exact credentialed origin, same-site cookie review, dependency scanning. | Frontend + security/backend |
| Authorization | Stale visible permissions or owner-as-role assumptions. | Bootstrap/refetch persisted context; invalidate on 401/403, focus and mutations; hide UI only after loading; direct URL guards. | Frontend |
| Privacy | Reusing recruiter DTO/components for candidate screens exposes hidden answers, feedback, approval/audit data. | Separate DTO adapters and candidate fixtures; negative projection tests. | Frontend + backend |
| Documents | Signed URL/provider metadata/checksum leakage; unsafe download state. | Never log/persist URLs; download just-in-time; render only server-downloadable states; redact telemetry. | Frontend |
| Accessibility | Pipeline board/table, charts, overlays, timers and autosave can fail keyboard/SR/zoom. | PipelineList equivalent, semantic tables, chart data tables, focus recovery, live-region discipline, reduced motion, axe + manual testing. | Design + frontend + QA |
| Responsive | Desktop source image can encourage squeezed tables/sidebar. | Drawer navigation, table-to-list recomposition, sticky action review, test 320px and 200% zoom. | Design + frontend |
| Performance | Composite dashboard fan-out, charts and large tables increase requests/bundle. | Route splitting, bounded queries, cancellation, server aggregation, defer Recharts, budgets. | Frontend + backend |
| Delivery | Unpinned target majors or incompatible Vite/Node deployment. | Resolve/install only in Phase 1, pin lockfile, CI on supported Node, Dependabot/Renovate policy. | Frontend/platform |
| Observability | Error telemetry could capture candidate or document data. | Allowlisted event fields, opaque correlation IDs, no response bodies/PII by default. | Frontend + security |

## Readiness gates

- [ ] Approve stack and statuses in [`DEPENDENCY_DECISIONS.md`](DEPENDENCY_DECISIONS.md).
- [ ] ADR explicitly reconciles current verified TypeScript 7.0.2/Vite 8.1.5/Router 8.2.0 with the supported-fallback brief baseline 5.9/7/7; compatibility/security review controls the choice.
- [ ] Approve deployment, Node runtime, browser matrix, CSP, font hosting and headless-primitives decisions.
- [ ] Add the approved visual reference at `../design-reference/talvix-recruiter-dashboard.png`.
- [ ] Agree on auth bootstrap/refetch behavior and documented response/error envelopes.
- [ ] Approve `/org/*` as canonical and the explicit `/recruiter/*` notification alias/redirect contract; inventory tests must cover every emitted action URL and identifier type.
- [ ] Approve candidate/recruiter/admin DTO separation and privacy test fixtures.
- [ ] Decide whether recruiter overview begins without exact aggregate parity; do not fabricate AI.
- [ ] Establish CI, lockfile, vulnerability and license review ownership.

**Go/no-go:** **Conditional GO for Phase 1 foundations after the first five gates. NO-GO for feature work and exact dashboard parity until relevant API gaps and visual custody are resolved.**
