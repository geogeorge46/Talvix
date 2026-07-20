# Talvix Responsive System

**Status:** Recommended; breakpoints are documentation values, not installed Tailwind configuration.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| No frontend | Mobile-first rules | Container queries after support review | Exact device test matrix |

## Breakpoints

| Name | Min width | Intent |
| --- | --- | --- |
| Base | 0 | Single-column phones and zoomed layouts |
| `sm` | 480px | Wider phones; paired minor controls |
| `md` | 768px | Tablet; secondary columns when useful |
| `lg` | 1024px | Persistent workspace navigation |
| `xl` | 1280px | Main + 320px context rail |
| `2xl` | 1536px | Max 1440px canvas; add whitespace, not density |

Tailwind conventions may mirror these values if Tailwind is approved and installed later. CSS behavior should be content-driven; breakpoint names are coordination tools, not device labels.

## Recomposition matrix

| Pattern | Base | `md` | `lg`/`xl` |
| --- | --- | --- | --- |
| App navigation | Header + modal drawer | Same | Persistent 256px sidebar |
| Page actions | Wrap; primary visible, others menu | Inline when fit | Inline toolbar |
| Detail/context rail | Main then context | Main then context | Two columns at `xl` |
| Forms | One column | Two-column related fields selectively | 640px form + explanatory aside |
| Data table | Essential columns + horizontal region or list switch | More columns | Full comparison set |
| Pipeline | PipelineList default | User can choose board | Board or list, preference retained |
| Evidence Rail | Vertical full width | Vertical | Vertical detail or horizontal summary |
| Dialog | Near-full viewport/bottom drawer | Bounded dialog | Bounded dialog |

## Responsive content rules

Do not hide consequential data solely due to width; move it into a disclosure or detail view. Preserve labels over icon-only compression. Filters move to a drawer but active-filter summary remains visible. Charts reduce series density and retain table alternatives. Avoid browser-sniffing and separate mobile feature sets.

## Accessibility and testing

Support reflow at 320 CSS px and 400% zoom without two-dimensional scrolling except essential tables/charts. Test keyboard and screen readers at narrow widths, landscape, 200% text, and dynamic browser chrome. Touch targets remain 44px. See [Accessibility](11_ACCESSIBILITY.md) and [Layout](04_LAYOUT_SYSTEM.md).

## Decision log

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| Five mobile-first breakpoints | Shared coordination without device assumptions | Device-specific layouts | Recommended |
| PipelineList defaults at base width | Reliable scanning and keyboard use | Horizontally compressed board | Recommended | Applications |
| Container queries wait for implementation review | Use only where component context benefits | Mandate immediately | Future/Decision Required | Toolchain |
