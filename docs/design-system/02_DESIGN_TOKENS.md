# Talvix Design Tokens

**Status:** Recommended token contract; reference values are documentation, not installed code.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| Backend facts only | Current design proposal | Dark theme and advanced themes | Build-tool representation |

## Scope and token model

Tokens form four layers: **primitive/reference** values (`--ref-blue-600`), **semantic** intent (`--color-action-primary`), **component** aliases (`--button-primary-bg`), and documented values used to review implementation. Product code consumes semantic or component tokens; primitives are allowed only inside token definitions, charts with an approved scale, or documented exceptions.

## Canonical reference values

| Family | Names and values |
| --- | --- |
| Neutral | `--ref-slate-0: #FFFFFF`; `--ref-slate-25: #F8FAFC`; `--ref-slate-50: #F1F5F9`; `--ref-slate-100: #E2E8F0`; `--ref-slate-200: #CBD5E1`; `--ref-slate-400: #64748B`; `--ref-slate-500: #475569`; `--ref-slate-600: #334155`; `--ref-slate-700: #1E293B`; `--ref-slate-900: #0F172A`; `--ref-slate-950: #080F1D` |
| Indigo | `--ref-indigo-50: #EEF2FF`; `--ref-indigo-100: #E0E7FF`; `--ref-indigo-500: #6366F1`; `--ref-indigo-600: #4F46E5`; `--ref-indigo-700: #4338CA`; `--ref-indigo-800: #3730A3` |
| Cyan | `--ref-cyan-50: #ECFEFF`; `--ref-cyan-500: #06B6D4`; `--ref-cyan-700: #0E7490`; `--ref-cyan-800: #155E75` |
| Green | `--ref-green-50: #ECFDF5`; `--ref-green-600: #059669`; `--ref-green-800: #065F46` |
| Amber | `--ref-amber-50: #FFFBEB`; `--ref-amber-600: #D97706`; `--ref-amber-900: #78350F` |
| Red | `--ref-red-50: #FEF2F2`; `--ref-red-600: #DC2626`; `--ref-red-800: #991B1B` |
| Blue | `--ref-blue-50: #EFF6FF`; `--ref-blue-600: #2563EB`; `--ref-blue-800: #1E40AF` |

## Semantic color and surface tokens

| Token | Reference value | Use |
| --- | --- | --- |
| `--surface-canvas` | `--ref-slate-25` → `#F8FAFC` | Mineral workspace |
| `--surface-1` | `--ref-slate-0` → `#FFFFFF` | Opaque primary work surface |
| `--surface-2` | `--ref-slate-50` → `#F1F5F9` | Subtle grouped region |
| `--surface-glass` | `rgba(255,255,255,.82)` | Navigation/floating chrome only |
| `--text-strong` | `--ref-slate-900` → `#0F172A` | Headings and key data |
| `--text-default` | `--ref-slate-700` → `#1E293B` | Body text |
| `--text-muted` | `--ref-slate-500` → `#475569` | Secondary text |
| `--text-disabled` | `--ref-slate-400` → `#64748B` | Disabled labels on `--surface-disabled` |
| `--border-default` | `--ref-slate-200` → `#CBD5E1` | Controls and boundaries |
| `--border-subtle` | `--ref-slate-100` → `#E2E8F0` | Internal separators |
| `--border-glass` | `rgba(203,213,225,.72)` | Glass chrome edge |
| `--color-action-primary` | `--ref-indigo-700` → `#4338CA` | Primary actions |
| `--color-action-primary-hover` | `--ref-indigo-800` → `#3730A3` | Hover |
| `--color-action-primary-pressed` | `--ref-indigo-800` → `#3730A3` | Pressed plus inset treatment |
| `--color-action-secondary` | `--ref-slate-700` → `#1E293B` | Secondary action foreground |
| `--color-focus` | `--ref-blue-600` → `#2563EB` | Focus ring |
| `--color-signal` | `--ref-cyan-700` → `#0E7490` | Restrained evidence signal |
| `--surface-hover` | `--ref-slate-50` → `#F1F5F9` | Neutral hover |
| `--surface-selected` | `--ref-indigo-50` → `#EEF2FF` | Selection background |
| `--surface-disabled` | `--ref-slate-100` → `#E2E8F0` | Disabled background |
| `--surface-overlay` | `rgba(8,15,29,.56)` | Modal scrim |

Status pairs are success `#065F46/#ECFDF5`, warning `#78350F/#FFFBEB`, danger `#991B1B/#FEF2F2`, and info `#1E40AF/#EFF6FF`. Foreground/background order is shown. Validate actual font-weight and context during implementation.

## Geometry, elevation, and layering

| Family | Tokens |
| --- | --- |
| Spacing | `--space-0: 0`; `--space-1: 4px`; `--space-2: 8px`; `--space-3: 12px`; `--space-4: 16px`; `--space-5: 24px`; `--space-6: 32px`; `--space-7: 40px`; `--space-8: 48px`; `--space-10: 64px`; `--space-12: 80px` |
| Radius | `--radius-sm: 4px`; `--radius-md: 8px`; `--radius-lg: 12px`; `--radius-xl: 16px`; `--radius-round: 999px` (avatars/badges only) |
| Border | `--border-1 1px`; `--border-2 2px` |
| Shadow | `--shadow-1: 0 1px 2px rgba(15,23,42,.08)`; `--shadow-2: 0 8px 24px rgba(15,23,42,.12)`; `--shadow-3: 0 20px 48px rgba(15,23,42,.16)` |
| Z-index | `--z-base: 0`; `--z-sticky: 100`; `--z-dropdown: 300`; `--z-overlay: 500`; `--z-modal: 600`; `--z-toast: 700`; `--z-tooltip: 800` |
| Content widths | `--content-text: 720px`; `--content-form: 640px`; `--content-wide: 1200px`; `--content-max: 1440px`; `--sidebar: 256px`; `--rail: 320px` |

## Effects, opacity, grid, and breakpoints

| Family | Complete variable mapping | Status |
| --- | --- | --- |
| Blur | `--blur-none: 0`; `--blur-glass: 16px`; `--blur-heavy: 24px` (floating navigation only) | Recommended |
| Opacity | `--opacity-disabled: .56`; `--opacity-muted: .72`; `--opacity-glass: .82`; `--opacity-scrim: .56` | Recommended |
| Grid | `--grid-columns: 12`; `--grid-gutter-mobile: 16px`; `--grid-gutter-tablet: 24px`; `--grid-gutter-desktop: 32px` | Recommended |
| Breakpoints | `--breakpoint-sm: 480px`; `--breakpoint-md: 768px`; `--breakpoint-lg: 1024px`; `--breakpoint-xl: 1280px`; `--breakpoint-2xl: 1536px` | Recommended documentation values |
| Control | `--control-min-height: 44px`; `--focus-width: 2px`; `--focus-offset: 2px` | Recommended |

## Representative component aliases

| Component token | Semantic mapping | Status |
| --- | --- | --- |
| `--button-primary-bg` / `--button-primary-bg-hover` / `--button-primary-bg-pressed` | `--color-action-primary` / hover / pressed | Recommended |
| `--button-secondary-fg` / `--button-secondary-border` | `--color-action-secondary` / `--border-default` | Recommended |
| `--input-bg` / `--input-border` / `--input-border-focus` | `--surface-1` / `--border-default` / `--color-focus` | Recommended |
| `--card-bg` / `--card-border` | `--surface-1` / `--border-subtle` | Recommended |
| `--nav-glass-bg` / `--nav-glass-border` / `--nav-glass-blur` | `--surface-glass` / `--border-glass` / `--blur-glass` | Recommended |
| `--selection-bg` / `--selection-fg` | `--surface-selected` / `--text-strong` | Recommended |
| `--dialog-scrim` | `--surface-overlay` | Recommended |

## Typography and motion aliases

Typography uses Geist and Geist Mono as **Recommended, not installed**. Type tokens: display `40/48, 650`; h1 `32/40, 650`; h2 `24/32, 650`; h3 `20/28, 600`; body-lg `18/28, 400`; body `16/24, 400`; body-sm `14/20, 400`; label `14/20, 600`; caption `12/16, 500`; mono `13/20, 500`. Responsive display/h1 become `32/40` and `28/36` below 768px.

Motion: `--duration-instant: 80ms`, `--duration-fast: 120ms`, `--duration-base: 180ms`, `--duration-slow: 280ms`; `--ease-standard: cubic-bezier(.2,0,0,1)`, `--ease-enter: cubic-bezier(0,0,0,1)`, `--ease-exit: cubic-bezier(.3,0,1,1)`. See [Typography](06_TYPOGRAPHY.md), [Color](07_COLOR_SYSTEM.md), [Spacing](09_SPACING_SYSTEM.md).

## Accessibility and governance

Semantic tokens make contrast and high-contrast adaptation centrally reviewable. Dark theme is **Future** and should remap semantic tokens rather than add component-specific dark values. Token changes require contrast checks, visual regression coverage, migration notes, owner approval, and a deprecation window: mark old name, publish replacement and rationale, support both for one agreed migration release, then remove only after usage search returns zero.

## Decision log

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| Full names are canonical; shorthand is invalid | Makes the contract mechanically unambiguous | Framework-generated names | Recommended | All styling layers |
| Breakpoints remain documentation tokens | CSS custom properties cannot drive media queries reliably | Build-time token export | Decision Required | Toolchain phase |
