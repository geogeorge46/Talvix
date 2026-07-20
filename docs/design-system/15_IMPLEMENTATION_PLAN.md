# Talvix Frontend Implementation Plan

**Status:** Recommended phased plan with no dates; no frontend implementation has begun.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| Backend capability | Planned frontend work | Deferred product areas | Approval needed before phase |

## Scope

Sequences architecture and design-system delivery without changing backend contracts or claiming uninstalled dependencies. Each phase exits only when its completion criteria are met.

## Phases

| Phase | Work | Completion criteria |
| --- | --- | --- |
| 0. Decisions and contract audit | Confirm MVP routes; framework/build, router, cache, forms, headless primitives, styling/Tailwind, Geist hosting, Lucide, tests; inventory API DTO/privacy boundaries | Decision record approved; route/role/permission matrix verified against API; candidate-safe DTO contracts documented |
| 1. Foundations | Initialize approved React + TypeScript toolchain; encode canonical tokens; font fallbacks; reset; testing/a11y harness | Token values match these docs; no raw product colors/spacing; baseline keyboard, contrast, reduced-motion tests pass |
| 2. Primitives | Buttons, links, form controls, alerts, dialog, menu, tabs, table/list, loading/empty/error | Component API, states, keyboard, focus, 44px targets, docs and tests complete |
| 3. Shell and routing | Providers, route layouts, AppShell, navigation, guards, permission-loading and denial states | Public/auth/candidate/org/admin shells recompose at all breakpoints; direct URL denial safe; API remains authoritative |
| 4. Shared domain patterns | EvidenceRail, status mapping, document upload, PipelineList/Board, ChartFrame, date/time | List alternative and chart table pass accessibility review; privacy-safe fixtures; error/concurrency states tested |
| 5. Candidate MVP | Profile, jobs, applications, assessments, interviews, offers, notifications | One reduced end-to-end candidate journey works with safe DTOs; loading/empty/error/deadline/session paths pass |
| 6. Organization MVP | Company/verification, jobs, pipeline, assessment, interview/scorecard, offers, team permissions | Persisted permission reload verified; owner modeled as membership; multi-user workflow and concurrency tests pass |
| 7. Admin MVP | Approval queues, domain oversight, notification operations, aggregate analytics/export | Admin-only access, UTC filters, accessible visualizations, safe aggregate export and privacy review pass |
| 8. Hardening and release | Performance, browser/AT matrix, security/privacy, observability, visual regression, content review | No serious accessibility defects; critical journeys pass; bundle/request budgets met; operational rollback/support runbook approved |

## Dependency gates

| Decision | Needed before | Acceptance question |
| --- | --- | --- |
| Framework/build and deployment | Phase 1 | Does it support strict TS, route splitting, CSP, testability? |
| Tailwind or CSS strategy | Phase 1 | Can semantic tokens remain the source of truth? |
| Headless primitives | Phase 2 | Are keyboard, focus, SSR, bundle, maintenance acceptable? |
| Geist/Lucide | Phase 1/2 | Are license, hosting, fallback, subset, bundle policies approved? |
| Router/cache/forms | Phase 3 | Are URL state, invalidation, draft recovery and errors explicit? |

## Release safeguards

Do not begin Future AI, GitHub OAuth/analysis, chat, billing, centralized audit logs, calendar/video integrations, OCR, or e-signature within these phases without a separate approved scope. Never weaken backend authorization or privacy to simplify UI. Automated tests must not call real Cloudinary or Resend.

## Accessibility implications

Accessibility is embedded in every exit criterion, with manual keyboard, zoom, reduced-motion, contrast, and screen-reader checks before release. PipelineList is delivered with PipelineBoard, not afterward. See [Accessibility](11_ACCESSIBILITY.md), [Component Tree](13_COMPONENT_TREE.md), and [Frontend Guidelines](14_FRONTEND_GUIDELINES.md).

## Definition of complete

The future frontend is complete for MVP only when approved role journeys work end to end; server-authoritative authorization and privacy boundaries hold; all system states are designed; canonical tokens remain consistent; responsive layouts recompose; WCAG 2.2 AA review passes; and operational monitoring, recovery, and ownership are documented.

## Decision log

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| Contract/privacy audit precedes initialization | Prevents unsafe DTOs and false capability assumptions | Start with screens | Recommended | Phase 0 |
| PipelineList ships with PipelineBoard | Accessibility equivalence cannot be deferred | Board-first delivery | Recommended | Phase 4/6 |
| No calendar dates in this plan | Sequencing depends on unresolved tool/product choices | Speculative schedule | Recommended | Planning governance |
