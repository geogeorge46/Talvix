# Talvix Frontend Guidelines

**Status:** Recommended engineering standard for the future client.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| Backend contracts | Practices below | PWA/native apps | Toolchain and dependency selections |

## Scope and principles

Build React + TypeScript feature modules around server-authoritative workflows. Do not claim a framework, Tailwind, Geist, Lucide, router, cache library, or headless library is installed. Prefer semantic HTML first, typed boundaries, progressive enhancement, and explicit system states.

## Engineering rules

| Area | Rule |
| --- | --- |
| Data | Map API DTOs to view models; never spread unreviewed responses into UI |
| Authorization | Reload current approval/membership/company/permissions; UI gating is convenience only |
| State | Server cache, URL, local UI, and drafts stay separate |
| Forms | Schema-backed validation; server errors mapped to fields/summary; preserve safe drafts |
| Mutations | Disable duplicate submit, expose pending state, use idempotency where API supports it |
| Errors | Render actionable inline/section/page recovery; toast is supplementary |
| Lists | URL-backed filters/sort/page; stable keys; bounded virtualization only after measurement |
| Uploads | Display server-derived limits; progress/cancel/retry; never expose signed URLs in logs |
| Styling | Semantic/component tokens; Tailwind utilities only if later installed and mapped to tokens |
| Components | Composition over prop explosion; native semantics before ARIA |
| Dates | Locale display, UTC transport, explicit consequential timezone |
| Analytics | Aggregate/admin-only; accessible tables; prevent formula interpretation on client exports too |

## Naming, exports, and props

| Concern | Convention | Example | Status |
| --- | --- | --- | --- |
| Component/file | PascalCase, one primary exported component | `CandidateSummary.tsx` | Recommended |
| Hook | `use` + capability; return named object for evolving APIs | `useJobFilters(): { filters, setFilter, clearAll }` | Recommended |
| Utility | camelCase verb/noun; focused file | `formatUtcRange.ts` | Recommended |
| Types | PascalCase domain meaning; distinguish DTO/ViewModel/Input | `CandidateSummaryDto`, `CandidateSummaryViewModel` | Recommended |
| Boolean props | Positive `is/has/can/should`; avoid double negatives | `isLoading`, `canEdit` | Recommended |
| Events | `on` + outcome; internal handler `handle` + outcome | `onStageChange`, `handleStageChange` | Recommended |
| Variants | Closed semantic union, not arbitrary style flags | `tone: 'info' | 'danger'` | Recommended |
| Exports | Named exports; feature public index only; no repository-wide barrel | `features/jobs/index.ts` | Recommended |

Props contain render data and event callbacks, not API clients or permission assumptions. Prefer children/slots for composition when content structure varies; use variants when a closed visual behavior is stable. Example: `PageHeader` composes `actions` and `metadata`; it does not accept dozens of `showX` booleans. `CandidateSummary` configures a closed `compact|row|shortlist` variant because semantics remain stable.

## State and hook placement

| Need | Placement | Prohibited duplication |
| --- | --- | --- |
| Remote domain records | Approved query/cache hooks in feature `queries/` | Context/store copy |
| Filters/page/tab | URL search params | Parallel local state |
| Open/selected ephemeral UI | Nearest component hook | App-wide provider |
| Long draft | Feature form/draft hook with dirty/recovery contract | URL or generic global store |
| Session/dependency | `app/providers` context | Feature-created competing provider |
| Cross-feature UI preference | `shared/stores` only after architecture approval | Ad hoc local-storage reads |

Hooks do not return JSX, hide navigation side effects, or silently swallow errors. Query hooks expose loading/error/refetch metadata; mutation hooks expose pending/outcome and accept typed inputs. Providers define ownership, value stability, and failure behavior in their public contract.

## Styling and Tailwind conventions

Tailwind is **Recommended for evaluation, not installed**. If approved, its theme maps to semantic tokens; arbitrary values (`mt-[13px]`, raw hex colors, ad hoc z-index) are prohibited except documented browser-workaround code. Class order should follow the approved formatter; conditional classes use one approved merge helper. Design-system components own focus, disabled, density, and interaction classes. Feature code may compose layout utilities but may not restyle primitive internals through selector reach-through.

CSS/custom properties remain the semantic contract even if utilities implement consumption. Global styles are limited to reset, font loading, tokens, base document defaults, and accessibility utilities. No `!important` unless an explained platform/third-party override is reviewed.

## Reuse and dependency thresholds

| Situation | Action | Status |
| --- | --- | --- |
| Same semantics used in 2+ features | Propose design-system composite after API/accessibility review | Recommended |
| Same domain behavior used on 2+ pages | Keep in domain feature public API | Recommended |
| Similar appearance but different semantics | Do not merge; share primitives/tokens | Recommended |
| One-off page composition | Keep local until reuse is evidenced | Recommended |
| Feature importing another feature internal path | Move shared contract to service/shared or use public entry | Prohibited |
| Design system importing services/features | Invert data through props/adapters | Prohibited |

## Privacy and security

Never place credentials, private notes, provider metadata, checksums, signed URLs, or hidden evaluator data in logs, analytics, errors, URLs, test snapshots, or client persistence. Candidate assessment responses exclude answers/explanations/hidden tests/raw snapshots; candidate interview views exclude private feedback/instructions/security/audit; candidate offer views exclude approval/snapshots/internal actors/corrections. Server-derived ownership/company scope is never overridden by client fields.

Do not execute candidate code in-process or add client claims of malware scanning. Suspicious, infected, quarantined, replaced, failed, and deleted documents are not represented as downloadable. Optional notification failure cannot make a successful document mutation look failed; reconcile from returned mutation state.

## Quality and review

| Gate | Minimum |
| --- | --- |
| Type safety | Strict TypeScript; no unexplained `any`; exhaustive domain status mapping |
| Tests | Unit for adapters/status maps; component interactions; route permission and error states; critical journeys |
| Accessibility | [Accessibility](11_ACCESSIBILITY.md) gates pass |
| Performance | Route-level splitting, measured bundle budgets, stable layouts, bounded requests |
| Observability | Sanitized error IDs and domain-safe telemetry; no PII by default |
| Review | Loading, empty, error, permission, concurrency, timeout, responsive and reduced-motion states |

## Content and visual discipline

Use Frost Ledger: mineral canvas, opaque work surfaces, selective glass chrome, sharp evidence hierarchy. Sentence case, plain language, specific recovery actions. EvidenceRail presents history without implying private detail. Avoid generic card grids, decorative gradients, excessive rounding, and animation overload.

## Decisions

Toolchain, browser support, localization scope, analytics vendor, error monitoring, CSP, package approval, and deployment model are **Decision Required**. See [Architecture](01_UI_ARCHITECTURE.md) and [Implementation Plan](15_IMPLEMENTATION_PLAN.md).

## Decision log

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| Named exports and narrow public indexes | Refactors remain searchable and boundaries explicit | Global barrels/default exports | Recommended | Imports/tooling |
| Composition for variable structure, variants for closed behavior | Avoids boolean-prop explosion | Configuration-only components | Recommended | Component APIs |
| Tailwind must consume semantic tokens | Utility use cannot bypass system intent | Default/raw palette utilities | Recommended if Tailwind approved | Styling review |
