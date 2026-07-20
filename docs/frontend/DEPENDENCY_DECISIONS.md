# Talvix frontend dependency decisions

Versions below reflect official npm verification supplied for 2026-07-19, but are not resolved package claims. “Current” is not automatically “approved.” The original brief baseline—TypeScript 5.9, Vite 7 and React Router 7—is superseded as a claim about what is current, but remains a supported-fallback option requiring an explicit written architecture decision. Compatibility, security, maintenance, deployment and peer-dependency review govern final selection, after which Phase 1 pins the lockfile.

In the tables, **Decision Required — recommended option (approval pending)** means the audit identifies the preferred package/direction, but adoption is not approved until the frontend-stack ADR is accepted. This is one status, not simultaneous approval and deferral.

## Runtime and UI stack

| Package | Purpose | Decision | Phase | Alternative/risk and rationale |
| --- | --- | --- | --- | --- |
| `react@19`, `react-dom@19` | UI runtime | **Decision Required — recommended option (approval pending)** | 1 | Mature component model; verify ecosystem peer ranges. |
| [`typescript@7.0.2`](https://www.npmjs.com/package/typescript) (current verified) | Strict types | **Decision Required — recommended option (approval pending)** | 1 | Enable strict/no unchecked access; verify ecosystem support. Brief baseline 5.9 is a supported fallback requiring ADR rationale, not current. |
| [`vite@8.1.5`](https://www.npmjs.com/package/vite), compatible `@vitejs/plugin-react-swc` (current verified) | Build/dev server | **Decision Required — recommended option (approval pending)** | 1 | Vite 8 requires Node 20.19+ or 22.12+, stricter than backend’s generic Node 20+. Brief baseline Vite 7 is a supported fallback requiring ADR rationale. |
| [`react-router@8.2.0`](https://www.npmjs.com/package/react-router) (current verified) | Nested route layouts, loaders/navigation | **Decision Required — recommended option (approval pending)** | 1 | Use library mode with explicit guards. Brief baseline Router 7 is a supported fallback requiring ADR rationale. Client guards are not security. |
| `@tanstack/react-query@5`, `@tanstack/react-query-devtools@5` | Server cache/mutations | **Decision Required — recommended option (approval pending)** | 1 | Devtools development-only; explicit keys/invalidation and no sensitive persistence. |
| `react-hook-form@7`, `@hookform/resolvers`, `zod@4` | Forms and runtime client schemas | **Decision Required — recommended option (approval pending)** | 1 | Align conceptual schemas with backend Zod 4 without importing backend internals. |
| `tailwindcss@4`, `@tailwindcss/vite` | Utility consumption of tokens | **Decision Required — recommended option (approval pending)** | 1 | Approve only with canonical CSS-variable semantic tokens; plain CSS modules is the fallback. |
| Selective `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-select`, `@radix-ui/react-checkbox` | Accessible behavior primitives | **Decision Required — recommended selective option (approval pending)** | 1/needed | Install only primitives actually used; verify keyboard behavior, bundle, styling and React 19 compatibility. |
| `lucide-react` | Outline icon set matching visual source | **Decision Required — recommended option (approval pending)** | 1 | Enforce icon registry, labels and tree-shakable imports. |
| `geist` | Brand typeface assets | **Decision Required — recommended option (approval pending)** | 1 | Prefer self-hosting/subsetting; approve license, CSP, fallback and performance. |
| `clsx`, `tailwind-merge`, `class-variance-authority` | Class composition and variants | **Decision Required — recommended if Tailwind is approved** | 1 | Centralize helpers; avoid boolean variant explosion. |
| `date-fns` | UTC transport/local display utilities | **Decision Required — recommended option (approval pending)** | 1 | Use explicit IANA timezone text on consequential dates; avoid implicit parsing. |
| `sonner` | Supplementary toast region | **Optional** | 2 | Never make toast the sole error/success channel; custom live region is alternative. |
| `recharts` | Analytics charts | **Deferred** | 6 | Install only for admin analytics; accessible data table is mandatory. |
| Redux / Zustand | Global client store | **Rejected initially** | — | Query cache + URL + local state + narrow providers cover current needs; reconsider only with measured cross-feature state. |

## Test and quality stack

| Package | Decision | Use |
| --- | --- | --- |
| `vitest`, `jsdom` | **Decision Required — recommended option (approval pending)** | Unit/component runner and DOM environment; align compatible majors during install. |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | **Decision Required — recommended option (approval pending)** | User-observable interaction and assertions. |
| `msw@2` | **Decision Required — recommended option (approval pending)** | Network-level contract fixtures for success/error/privacy states; never real Cloudinary/Resend calls. |
| `axe-core`, `vitest-axe` | **Decision Required — recommended option (approval pending)** | Automated component accessibility checks; manual checks still required. |
| `@playwright/test`, `@axe-core/playwright` | **Decision Required — recommended option (approval pending)** | Critical journeys, direct URL guards, breakpoints and browser accessibility smoke. |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | **Decision Required — recommended option (approval pending)** | Strict static-quality gate; resolve mutually compatible majors. |
| `prettier`, `prettier-plugin-tailwindcss` | **Decision Required — recommended if Tailwind is approved** | Formatting and deterministic utility order. |

## Decision summary

| Status | Items | Approval needed |
| --- | --- | --- |
| **Decision Required — recommended option (approval pending)** | React; current verified TypeScript 7.0.2, Vite 8.1.5 and Router 8.2.0; Query; RHF/resolvers/Zod; Tailwind token strategy; selective Radix; Lucide; Geist; date-fns; testing/lint stack | Approve in one Phase 1 frontend-stack ADR. The 5.9/7/7 brief baseline remains an explicit supported fallback, not “current.” |
| **Decision Required — platform choice** | Deployment; Node line; CSP; supported browsers; package manager; font hosting | Must close before initialization. |
| **Deferred** | Recharts, monitoring/analytics SDK, localization library, PWA | Add only when phase requirements exist and privacy review passes. |
| **Rejected initially** | Redux, Zustand, full visual component kit, token persistence, axios without a proven need | Avoid duplicate state, generic aesthetics and unnecessary surface. |
| **Future** | AI/GitHub/chat/billing/calendar-video/OCR/e-signature SDKs | No API/product approval; do not install. |

## API client and state decisions

Use the platform `fetch` API behind one typed client that provides base URL joining, bearer header injection, abort signals, envelope/error parsing and correlation IDs. Centralize a narrow cookie-credentials allowlist: cross-origin `POST /auth/register`, `/auth/login`, `/auth/refresh`, and `/auth/logout` use `credentials: 'include'` because those responses set, rotate, or clear the HttpOnly refresh cookie. Ordinary bearer-only calls omit credentials unless deployment policy requires otherwise. Hold the access token in memory only; on a qualifying 401, perform one shared single-flight refresh and replay each eligible request at most once. Do not store tokens in `localStorage`, `sessionStorage`, URLs, query caches or logs. Query keys include actor/company and filters; clear all user-scoped cache on logout or identity/company-context change. URL owns list filters/page; React Query owns remote records; RHF owns form drafts; component state owns overlays.

## Frontend environment proposal

| Variable | Classification | Rule |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Public build configuration | Full API root/origin selected per environment; never a credential. |
| `VITE_ENABLE_<REVIEWED_FEATURE>` | Optional public flag | Only for non-secret, approved rollout display; server capability/authorization remains authoritative. |

Never mirror `JWT_*`, MongoDB, Resend, Cloudinary, cookie, provider keys, or other backend secrets. Vite-prefixed values are client-visible. Validate public env at startup and fail clearly on an invalid URL.

## Security and update policy

1. Choose npm unless platform policy selects another manager; commit one lockfile and use frozen/clean installs in CI.
2. Pin direct dependencies through the lockfile; review target-major upgrades deliberately rather than accepting floating majors.
3. Run audit/advisory, license, typecheck, lint, unit, accessibility and Playwright gates in CI. A critical exploitable production advisory blocks release; document time-bounded exceptions.
4. Enable automated update PRs with grouped low-risk dev updates and separate runtime majors. Require tests, bundle delta and changelog review.
5. Minimize packages, import selectively, remove unused dependencies, and record ownership/purpose. No install scripts or CDN runtime assets without review.
6. Generate an SBOM/build manifest if deployment policy supports it; preserve reproducible artifacts and rollback to the previous immutable deployment.

## Phase 1 compatibility gate

- Record the ADR’s exact choice: current verified TypeScript 7.0.2/Vite 8.1.5/React Router 8.2.0, or the brief’s supported-fallback baseline of TypeScript 5.9/Vite 7/Router 7. A fallback choice needs maintenance/security/compatibility justification and must not be labelled current.
- If Vite 8 is selected, standardize frontend CI/deployment on Node 20.19+ or 22.12+; do not assume backend “Node 20+” is sufficient. Resolve React 19 peer compatibility for Router, Query, RHF, Radix and test tools.
- Confirm Tailwind 4/PostCSS/Vite integration and Prettier plugin compatibility.
- Confirm Geist license/self-hosted subsets and CSP directives.
- Capture exact resolved versions in `frontend/package.json` and lockfile only after approval.
