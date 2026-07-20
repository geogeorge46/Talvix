# Talvix Motion System

**Status:** Recommended; motion is not implemented.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| None in frontend | Motion contract | Advanced visualization transitions | Native/View Transition use |

## Scope and tokens

Motion communicates state and spatial continuity; it never delays work or decorates dense data. Canonical durations are `80ms` instant, `120ms` fast, `180ms` base, and `280ms` slow. Easing: standard `cubic-bezier(.2,0,0,1)`, enter `cubic-bezier(0,0,0,1)`, exit `cubic-bezier(.3,0,1,1)`.

| Interaction | Duration/easing | Property | Rule |
| --- | --- | --- | --- |
| Hover/focus feedback | 120ms standard | color, border, shadow | No positional movement required to understand state |
| Disclosure/menu | 180ms enter/exit | opacity + ≤8px translation | Focus changes after visibility is established |
| Dialog/drawer | 280ms enter, 180ms exit | opacity + ≤16px translation | No spring/overshoot |
| Toast | 180ms enter/exit | opacity + ≤8px | Timer pauses on hover/focus |
| Evidence state update | 180ms standard | color/opacity | Text and icon update immediately |
| Skeleton | 1200ms loop | restrained luminance | Disabled under reduced motion |
| Page transition | 180ms enter | opacity only; no route slide | Content and focus semantics update immediately |
| Tooltip | 120ms enter, 80ms exit; 400ms initial delay | opacity | No delay for keyboard repeat visit; never required content |
| Button | 80ms instant/120ms standard | color, border, shadow; no scale bounce | Loading indicator does not change width |
| Card interactive | 120ms standard | border and shadow only | Noninteractive cards have no hover motion |
| Drag preview | 120ms pickup; 180ms settle | transform/opacity | Explicit keyboard move remains equivalent |
| Error shake | Not permitted | — | Motion must not be required to find error |

## State transitions

Loading content preserves final geometry when practical. Optimistic mutations need a reversible pending state; consequential workflow changes should wait for server confirmation. Drag-and-drop pipeline motion supplements explicit keyboard “Move to stage” actions and does not become the only interaction.

## Reduced motion

Under `prefers-reduced-motion: reduce`, eliminate translation, parallax, animated counting, auto-scrolling, and skeleton shimmer. Use immediate state swaps or ≤80ms opacity changes. Never animate focus position. Users can still perceive completion through copy, icon, and live-region announcements.

## Decisions and rationale

| Decision | Rationale |
| --- | --- |
| Maximum standard transition 280ms | Talvix should feel quick and operational |
| Transform/opacity preferred | Reduces layout work and visual instability |
| No celebratory motion for hiring outcomes | Consequential states require calm neutrality |
| Motion tokens, not arbitrary durations | Predictable interaction language |

## Accessibility implications

Motion cannot flash more than three times per second, create vestibular zoom, or be necessary to locate state. Live updates follow [Accessibility](11_ACCESSIBILITY.md). Token source: [Design Tokens](02_DESIGN_TOKENS.md).

## Decision log

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| Route transitions use opacity only | Avoids spatial fiction and vestibular discomfort | Horizontal page slide | Recommended | Router layout |
| Tooltip delay is 400ms initially | Reduces accidental noise | Immediate display | Recommended | Tooltip primitive |
| Error shake is prohibited | Error summary/focus is clearer | Animated invalid control | Recommended | Forms |
