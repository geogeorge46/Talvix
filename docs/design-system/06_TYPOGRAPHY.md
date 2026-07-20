# Talvix Typography

**Status:** Geist and Geist Mono are Recommended dependencies, not installed.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| No frontend fonts | Geist system below | Additional scripts/fonts | Hosting/licensing and loading method |

## Scope

Typography provides product identity and dense-data legibility. Geist is the UI/editorial family; Geist Mono is restricted to identifiers, timestamps, shortcut labels, code, and aligned technical data. A standards-compliant system sans/monospace fallback must remain usable during loading.

## Semantic scale

| Token | Desktop size/line | Weight | Small-screen override | Use |
| --- | --- | --- | --- | --- |
| `--type-display` | 40/48px | 650 | 32/40px | Public/editorial hero only |
| `--type-h1` | 32/40px | 650 | 28/36px | Page title |
| `--type-h2` | 24/32px | 650 | same | Major section |
| `--type-h3` | 20/28px | 600 | same | Subsection |
| `--type-body-lg` | 18/28px | 400 | same | Introductory copy |
| `--type-body` | 16/24px | 400 | same | Default text/input |
| `--type-body-sm` | 14/20px | 400 | same | Dense supporting text |
| `--type-label` | 14/20px | 600 | same | Labels/actions |
| `--type-caption` | 12/16px | 500 | same | Metadata; never essential instructions alone |
| `--type-mono` | 13/20px | 500 | same | IDs/timestamps/code |

Use sentence case. Default tracking is normal; display headings may use `-0.02em`, labels `0`, and uppercase micro-labels are discouraged. Body measure caps at 72 characters and long-form width at `720px`. Numeric tables may use tabular numerals.

## Usage examples and aliases

| Content example | Token | Example treatment | Status |
| --- | --- | --- | --- |
| Page title | `--type-h1` | “Applications” | Recommended |
| Section title | `--type-h2` | “Interview rounds” | Recommended |
| Surface title | `--type-h3` | “Next action” | Recommended |
| Intro | `--type-body-lg` | One-sentence page explanation | Recommended |
| Field/body | `--type-body` | Job description and input text | Recommended |
| Dense support | `--type-body-sm` | Table secondary line | Recommended |
| Control label | `--type-label` | “Move to interview” | Recommended |
| Metadata | `--type-metadata` aliases `--type-caption` | “Updated 19 Jul 2026” | Recommended alias |
| Identifier | `--type-code` aliases `--type-mono` | `APP-10482` or keyboard shortcut | Recommended alias |

Metadata and code aliases are intentional semantic names sharing metrics, not missing scale steps. A future theme may alter an alias independently without changing component vocabulary. Do not use mono for salary or ordinary numeric columns merely for visual effect; tabular numerals in Geist are preferred.

## Content rules

One `h1` names the page; levels do not skip for visual size. Buttons use verbs; status labels use nouns/adjectives. Dates display locale-friendly text plus explicit timezone where consequential. IDs may use mono but require accessible copy controls. Truncate only when the full value is available through an adjacent disclosure—not tooltip alone.

## Decisions and rationale

| Decision | Why |
| --- | --- |
| Semantic tokens instead of per-component sizes | Maintains hierarchy across features |
| 16px default form text | Readability and mobile zoom safety |
| Mono used sparingly | Technical evidence stands out without making UI mechanical |

## Accessibility implications

Text must resize to 200% without loss. Do not encode hierarchy only through weight or color. Avoid justified text, long all-caps strings, and line heights below the scale. Font loading must avoid invisible text. See [Color](07_COLOR_SYSTEM.md) and [Responsive System](10_RESPONSIVE_SYSTEM.md).

## Decision log

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| Metadata/code are semantic aliases | Clear component intent without unnecessary sizes | Independent sizes | Recommended | Tokens and components |
| Geist loading must show fallback text | Prevents invisible content | Blocking font load | Recommended; dependency not installed | Initialization |
