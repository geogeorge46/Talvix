# Talvix Spacing System

**Status:** Recommended 8-point foundation with a controlled 4px half-step.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| No frontend spacing | Scale below | User-selectable density | Compact density scope |

## Scope and scale

| Token | Value | Intended use |
| --- | --- | --- |
| `--space-0` | 0 | Reset |
| `--space-1` | 4px | Half-step: icon/text gaps, compact internal alignment only |
| `--space-2` | 8px | Tight control gap |
| `--space-3` | 12px | Compact padding (8 + 4) |
| `--space-4` | 16px | Standard control/group spacing |
| `--space-5` | 24px | Surface padding |
| `--space-6` | 32px | Page section spacing |
| `--space-7` | 40px | Large separation |
| `--space-8` | 48px | Major region |
| `--space-10` | 64px | Public/editorial region |
| `--space-12` | 80px | Rare display spacing |

The 4px token cannot become a parallel base grid. Layout dimensions should resolve to 8px multiples unless optical/internal alignment requires 4px. Arbitrary 6/10/14/18px gaps are prohibited without a documented component exception.

## Recipes

| Context | Inset | Gap |
| --- | --- | --- |
| Standard control | 12px vertical / 16px horizontal; minimum 44px height | 8px icon-label |
| Compact table row | Minimum 44px row | 12–16px cells |
| Work surface | 24px desktop, 16px mobile | 24px groups |
| Form | — | 24px fields, 8px label-to-control, 8px hint/error |
| Page | 32px desktop, 24px tablet, 16px mobile gutter | 32px sections |
| Dialog | 24px | 24px body regions, 16px actions |

## Decisions and accessibility

Density may reduce visual whitespace but never targets below 44px or body text below 14px for dense support text. Touch targets may overlap visually only if their hit areas do not. Spacing communicates grouping, but headings, landmarks, and borders also expose structure. See [Layout](04_LAYOUT_SYSTEM.md) and [Responsive](10_RESPONSIVE_SYSTEM.md).

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| 8px foundation with controlled 4px half-step | Predictable rhythm with optical precision | 4px universal grid | Recommended | Tokens/layout/components |
| 44px remains invariant under density | Touch and motor accessibility | Compact 32px controls | Recommended | Tables/forms/toolbars |
| Arbitrary gaps require exception review | Prevents gradual token erosion | Freeform spacing | Recommended | Code review |
