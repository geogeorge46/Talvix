# Talvix Color System

**Status:** Recommended Frost Glass light theme; dark theme is Future.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| No frontend palette | Light semantic palette | Dark/high-contrast remaps | Brand approval |

## Scope

Defines accessible semantic roles. Primitive values and the full token hierarchy live in [Design Tokens](02_DESIGN_TOKENS.md).

## Canonical neutral scale

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| `--ref-slate-0` | `#FFFFFF` | `--ref-slate-25` | `#F8FAFC` |
| `--ref-slate-50` | `#F1F5F9` | `--ref-slate-100` | `#E2E8F0` |
| `--ref-slate-200` | `#CBD5E1` | `--ref-slate-400` | `#64748B` |
| `--ref-slate-500` | `#475569` | `--ref-slate-600` | `#334155` |
| `--ref-slate-700` | `#1E293B` | `--ref-slate-900` | `#0F172A` |
| `--ref-slate-950` | `#080F1D` | — | — |

| Role | Value | Typical use |
| --- | --- | --- |
| Canvas | `#F8FAFC` | Mineral workspace |
| Surface 1 / 2 | `#FFFFFF` / `#F1F5F9` | Opaque work / grouped region |
| Glass | `rgba(255,255,255,.82)` | Navigation overlays only |
| Strong/default/muted text | `#0F172A` / `#1E293B` / `#475569` | Content hierarchy |
| Default/subtle border | `#CBD5E1` / `#E2E8F0` | Controls / separators |
| Primary/hover | `--color-action-primary` / `--color-action-primary-hover` | Actions, active navigation |
| Focus | `--color-focus` | `--focus-width` indicator with `--focus-offset` |
| Signal | `#0E7490` | Evidence accents, not primary actions |
| Secondary action | `--text-default` on `--surface-1`, border `--border-default` | Non-primary actions |
| Hover / pressed | `--surface-hover #F1F5F9` / primary `#3730A3` | Pointer and pressed feedback, plus shape/shadow |
| Selected | `--text-strong #0F172A` on `--surface-selected #EEF2FF` | Selected rows, tabs, navigation |
| Disabled | `--text-disabled #64748B` on `--surface-disabled #E2E8F0` | Noninteractive controls; semantics preserved |
| Glass border | `--border-glass rgba(203,213,225,.72)` | Chrome boundary only |
| Overlay/scrim | `--surface-overlay rgba(8,15,29,.56)` | Modal background; content beneath is inert |

## Status colors

| Status | Foreground/background | Additional cue |
| --- | --- | --- |
| Success | `#065F46` / `#ECFDF5` | Check icon + label |
| Warning | `#78350F` / `#FFFBEB` | Alert icon + label |
| Danger | `#991B1B` / `#FEF2F2` | Error icon + label |
| Information | `#1E40AF` / `#EFF6FF` | Info icon + label |
| Neutral | `#334155` / `#F1F5F9` | Text label |

These pairs target WCAG 2.2 AA but must be measured in rendered contexts, including disabled and glass backdrops. Disabled controls retain readable labels and use opacity only alongside semantic state.

## Data visualization

Use the ordered categorical set indigo `#4F46E5`, cyan `#0E7490`, amber `#B45309`, green `#047857`, magenta `#BE185D`, slate `#475569`. Never use red/green alone to compare outcomes. Lines differ by dash/marker; bars may use patterns; every chart has legend, text summary, and data-table alternative. Funnel stage colors do not imply value judgment.

## Glass and dark-theme compatibility

Glass requires backdrop testing and an opaque fallback; forms, tables, menus with dense text, and dialogs remain opaque. Future dark mode remaps semantic roles; components must not branch on primitive colors. Do not generate a dark palette until the product owner approves scope.

## Accessibility implications and decisions

Text targets 4.5:1 (3:1 for large text); UI boundaries and focus indicators target 3:1 against adjacent colors. Current/selected/error states combine color with text, shape, or icon. The restrained cyan signal preserves the evidence identity without creating neon or sci-fi styling.

## Decision log

| Decision | Rationale | Alternative | Status | Downstream impact |
| --- | --- | --- | --- | --- |
| Secondary is neutral, not another brand hue | Keeps evidence/status colors legible | Violet secondary fill | Recommended | Buttons, filters, toolbar |
| Glass is chrome-only with opaque fallback | Backdrop uncertainty can break contrast | Glass cards/forms | Recommended | Navigation and floating utilities |
| Dark theme is semantic remapping | Avoids component forks | Per-component overrides | Future | Token architecture |
