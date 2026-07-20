# Talvix frontend

Phase 4 adds the application bootstrap, routing, authentication integration, role-aware layouts, capability-aware navigation, and responsive Talvix shell. Workspace routes intentionally contain neutral placeholders; business pages remain out of scope.

Public exports from `src/design-system` include all Phase 2 primitives plus Card, MetricCard, Dialog, ConfirmDialog, Drawer, Menu, Dropdown, Tabs, Accordion, Breadcrumbs, Pagination, ToastProvider/useToast/Toast/ToastRegion, all shared system states, DataTable, DescriptionList, List, PageHeader, and Toolbar. Import through this barrel rather than internal files. Controls consume semantic tokens only.

Phase 4 adds React Router and TanStack Query. Platform `fetch` powers the typed API client; Axios, client state libraries, runtime schemas, and form packages are intentionally absent.

## Application architecture

- `src/api` normalizes backend errors and owns memory-only bearer tokens, credentialed refresh, single-flight 401 recovery, one replay, and `AbortSignal` support.
- `src/auth` restores sessions with `/auth/refresh` then `/auth/me`, clears identity-scoped query data, and loads advisory recruiter context from `/recruiters/me`.
- `src/routing` guards `/candidate`, `/org`, and `/admin` by the exact backend roles and guards organization areas by exact permission strings.
- `src/layouts` and `src/shell` provide public/auth/workspace layouts, shared navigation, landmarks, skip navigation, mobile Drawer, and the 1024px responsive contract.
- Authentication pages are `/login`, `/register`, and `/session-expired`; the backend does not support frontend password-reset or email-verification flows, so none are exposed.

Copy `.env.example` to a local uncommitted environment file when needed. `VITE_API_BASE_URL` defaults in development to `http://localhost:5000/api/v1`; it is not a secret. Refresh requests use the HttpOnly cookie with credentials, while bearer API calls omit credentials.

Recruiter permissions and company data from `/recruiters/me` are advisory navigation context only. The current backend does not offer a consolidated frontend-safe DTO that proves active organization membership; direct backend authorization remains authoritative and capability context should be refreshed following denied access or stale focus.

Radix supplies overlay focus trapping/restoration and keyboard behavior. DataTable renders a semantic table at wide breakpoints and a structured-list alternative at narrow breakpoints; CSS ensures only one representation is exposed at a time. Toasts are queued through `ToastProvider`, pause for hover, focus, and hidden documents, and allow Escape dismissal. Pagination uses a bounded window with noninteractive ellipses for large result sets.

## Setup and scripts

### Phase 5 organization dashboard

The verified recruiter index route (`/org`) composes independent,
permission-gated queries for managed jobs, managed applications, the all-time
application pipeline, the interview calendar, and offer analytics. Dashboard
range, candidate search, stage, and page are URL-owned (`range`, `q`, `stage`,
and `page`), and partial endpoint failures stay local to their section.

Transport objects are defensively projected into privacy-safe view models.
Candidate email, phone, address, document links/provider IDs, answers, notes,
and raw snapshots never enter the dashboard render model. Interview projections
omit meeting links, passwords, instructions, private feedback, and audit data.

No AI dashboard endpoint exists. The AI Insights region is an explicit
unavailable integration boundary, and deterministic skill-match and pipeline
signals are labelled as such. The managed-jobs endpoint is capped at 50 and has
no status filter, so active-job counts are marked partial when pagination shows
more rows. Pipeline figures are labelled all-time because that endpoint has no
date filter.

Requires Node >=20.19.0 or >=22.12.0 and npm. Run `npm install`, then `npm run dev`. The development server displays the component/token showcase. Production builds show only a minimal foundation placeholder.

| Script                            | Purpose                                               |
| --------------------------------- | ----------------------------------------------------- |
| `npm run dev`                     | Start Vite development server                         |
| `npm run build`                   | Strict TypeScript project build and production bundle |
| `npm run preview`                 | Preview the production bundle                         |
| `npm run typecheck`               | Run strict TypeScript checks                          |
| `npm run lint`                    | Run ESLint with zero warnings allowed                 |
| `npm run format` / `format:check` | Apply/check Prettier formatting                       |
| `npm test` / `test:watch`         | Run/watch Vitest tests                                |

## Foundation architecture

- `src/design-system/tokens/reference.css` is the only source for raw approved brand values.
- `semantic.css` maps references and accessible derived colors to purpose-based roles.
- `foundations.css` defines type, 8px spacing (plus the documented 4px half-step), radii, borders, depth, motion, opacity, blur, layers, containers, and breakpoints.
- Typography includes explicit code sizing/leading and 400/500/600/700 semantic weights; layout includes a 12-column grid, gutter/margin, and 8/4 content/sidebar aliases.
- `styles.css` owns the reset, base document behavior, focus, selection, reduced motion, visually hidden text, and skip-link foundation.
- `TokenPreview.tsx` and its stylesheet are development documentation, not product features.

Feature code must consume semantic custom properties. It must not use raw brand hex values, arbitrary spacing, or ad hoc z-index values. Caribbean Green uses Steel Gray text for accessible actions; `--color-action-hover` and `--color-action-pressed` are darker derived interaction values.
Focus uses a dark semantic ring plus a Snow halo so it remains distinguishable on green, light, and Steel surfaces. AI and success have independent reference and semantic contracts even where their palette relationship is intentional.

## Dependencies

Runtime: React and React DOM 19, `react-router-dom@7.18.1`, `@tanstack/react-query@5.101.2`, `lucide-react@1.25.0`, `@radix-ui/react-dialog@1.1.19`, `@radix-ui/react-dropdown-menu@2.1.20`, `@radix-ui/react-tabs@1.1.17`, and `@radix-ui/react-accordion@1.2.16`.

Geist Sans and Geist Mono variable WOFF2 files are vendored under `src/assets/fonts/`; they are not a runtime package dependency. Their SIL Open Font License and attribution are preserved in `src/assets/fonts/LICENSE.txt`.

Development: Tailwind CSS 4 and its Vite adapter (semantic CSS variables remain canonical), TypeScript, Vite, React SWC, ESLint flat config with TypeScript/React Hooks/React Refresh/JSX accessibility rules, Prettier with its Tailwind plugin, Vitest/jsdom, Testing Library, axe-core, vitest-axe, and type packages. `@vitest/coverage-v8` is installed as the compatible coverage foundation but no coverage threshold is approved yet. On npm 11/Windows, a clean `npm ci` installs Rolldown's optional WASM fallback packages but reports them as extraneous unless they are declared directly. The pinned `@napi-rs/wasm-runtime`, `@emnapi/wasi-threads`, `@tybys/wasm-util`, and `tslib` dev entries are the narrow Vite/Rolldown toolchain workaround that keeps `npm ls` reproducible and clean; they are not application runtime dependencies.

Deliberately deferred until the phase that uses them: React Router, TanStack Query, React Hook Form, Zod, date-fns, charts, Playwright, and MSW.

## Unresolved decisions

Inherited Phase 2 follow-up remains for broader browser/assistive-technology verification of Tooltip description timing, native read-only form semantics, Combobox controlled-value behavior, and compact inline-link target sizing. Phase 3 does not claim those primitive concerns are closed.

- Browser support and assistive-technology test matrix
- Deployment, CSP, runtime API origin, and error/analytics vendors
- Font subsetting strategy and performance budget
- Tailwind utility adoption beyond the installed token-compatible foundation
- Coverage thresholds and the Phase 2 primitive-library decision

# Phase 6 job management

Recruiter job routes use the real `/jobs/manage` contract. Search is server-wide; status, employment, and work-mode controls are explicitly current-page filters because the service currently ignores those accepted query parameters. Recruiters submit drafts for admin review and can pause, resume, close, or archive only in supported states; the intentionally forbidden recruiter publish endpoint is never used.

Access follows persisted `jobs.create`, `jobs.update`, `jobs.delete`, and `jobs.publish` permissions plus current organization approval, activity, and verification state. Drafts contain only allowlisted job form fields and are scoped by actor, company, and job in versioned `sessionStorage`; authentication data is never persisted there.

Routes: `/org/jobs`, `/org/jobs/new`, `/org/jobs/:jobId`, `/org/jobs/:jobId/edit`.

# Phase 7 recruiter ATS workspace

Recruiters with persisted `applications.view` access use `/org/applications` and `/org/candidates`. These routes call the real `/applications/manage`, `/applications/manage/pipeline`, `/applications/manage/:id`, `/candidates`, and `/candidates/:id` contracts. Stage mutation calls `/applications/manage/:id/status` only with `applications.manage`.

Filters, sorting, pagination, and board/list choice use URL state. Board and accessible list render the same current server page; pipeline totals are separately labelled. No bulk UI exists, and candidate actions are view-only because the backend has no recruiter-side candidate mutations.

Defensive adapters allowlist recruiter-safe snapshots and submitted evidence. Contact data, compensation, resume URLs/provider IDs, social accounts, actor IDs, and internal notes are discarded. Status movement is explicit and confirmed. A `409` refetches data without retrying the mutation, requiring a new valid choice.
