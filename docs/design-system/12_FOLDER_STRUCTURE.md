# Talvix Frontend Folder Structure

**Status:** Recommended future React + TypeScript structure; `frontend/` currently contains only README.md.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| Backend only | Structure below | AI/GitHub/chat/billing modules | Framework, router, packages |

## Scope

This is a naming and dependency proposal, not permission to initialize the frontend.

```text
frontend/
  src/
    app/                 # bootstrap, providers, router, route layouts
      providers/
      routes/
      guards/
    layouts/             # PublicLayout, AuthLayout, WorkspaceLayout
    design-system/
      tokens/            # generated/declared token artifacts later
      primitives/
      composites/
      patterns/          # EvidenceRail, PipelineList, system states
    components/          # intentionally absent as a generic dumping ground; see mapping below
    features/
      auth/
      candidate-profile/
      companies/
      jobs/
      applications/
      assessments/
      interviews/
      offers/
      notifications/
      documents/
      admin-analytics/
      team-permissions/
    services/
      http/
      dto/
      uploads/
    shared/
      hooks/
      utils/
      types/
      constants/
      contexts/          # narrowly shared React contexts only
      stores/            # approved cross-feature client state only
    styles/              # global reset, font faces, semantic token entry and utilities
    assets/
    tests/
  public/
```

## Boundary rules

| From | May depend on | Must not depend on |
| --- | --- | --- |
| Design-system primitives | tokens, shared types | feature modules, services |
| Design-system patterns | primitives, tokens | domain API DTOs |
| Feature | design system, services, shared | another feature’s internals |
| Services | shared types/config | React components |
| Layout/app | features’ public entry points, design system | feature internals |

## Requested responsibility mapping

| Conventional area | Talvix placement | Rule | Status |
| --- | --- | --- | --- |
| `components` | `design-system/*` for reusable UI; `features/<name>/components` for domain UI | No root generic component files; the placeholder comment above documents intent, not a directory to create | Recommended |
| `contexts` | `app/providers` for app-wide providers; `shared/contexts` only when genuinely cross-feature | Context is for dependency propagation, not routine server/client state | Recommended |
| `stores` | Feature-local state by default; `shared/stores` only for approved cross-feature client UI state | Server cache and URL state never duplicated into a store | Recommended |
| `styles` | `styles/` global reset/font/token entry; component styles co-located or token-backed utilities | No feature-specific global selectors | Recommended |
| `hooks` | Feature hooks beside feature; generic hooks in `shared/hooks` | Hook name expresses capability and returns stable documented shape | Recommended |

Each feature exposes a narrow public index and may contain `components/`, `routes/`, `queries/`, `mutations/`, `adapters/`, `schemas/`, `hooks/`, and `tests/`. API DTOs remain in services/feature adapters; view models exclude private fields by construction.

## Naming and tests

Components use PascalCase (`EvidenceRail.tsx`), hooks `use…`, utilities camelCase, and route modules descriptive nouns. Co-locate component unit/accessibility tests; keep cross-feature journey tests in `src/tests/`. Avoid a generic `components/` dumping ground and global `helpers.ts`.

## Future boundaries

`ai-assistance`, `github-evidence`, `chat`, and `billing` must not exist as empty implied capabilities. Add them only when product and API scope is approved. Owner capabilities live in organization features gated by persisted membership, not a fourth role folder.

## Accessibility implications and decisions

Central primitives prevent divergent keyboard behavior; feature-owned adapters prevent privacy leaks. Choice of framework, router, query/cache layer, forms, validation sharing, test tools, headless primitives, CSS/Tailwind, and code generation remains **Decision Required**. See [Architecture](01_UI_ARCHITECTURE.md) and [Guidelines](14_FRONTEND_GUIDELINES.md).

## Decision log

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| No generic root component bucket | Ownership remains discoverable | `src/components/*` catch-all | Recommended | Imports/review |
| Contexts/stores are explicit narrow escape hatches | Prevents global-state drift | Central store for all state | Recommended | State architecture |
| Global styles have a constrained home | Reset/fonts/tokens need predictable load order | Feature-imported global CSS | Recommended | Initialization |
