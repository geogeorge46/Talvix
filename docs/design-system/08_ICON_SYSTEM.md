# Talvix Icon System

**Status:** Lucide is Recommended, not installed; package selection is Decision Required.

## Status legend and scope

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| No frontend icons | Consistent outline system | Custom brand illustrations | Icon package and bundling |

Icons clarify actions, objects, statuses, and the Evidence Rail. Use one outline family with 2px optical stroke, rounded joins, and sizes 16, 20, and 24px. Use 16px within dense labels, 20px in standard controls, 24px for standalone emphasis; maintain 44px interactive targets regardless of glyph size.

## Semantic mapping

| Meaning | Recommended icon concept | Label rule |
| --- | --- | --- |
| Search/filter/sort | magnifier, funnel, arrows | Visible label in primary workflows |
| Add/edit/delete | plus, pencil, trash | Delete always paired with text in consequential contexts |
| Candidate/company/job | user, building, briefcase | Decorative beside visible noun |
| Evidence/document | file-check, paperclip | Name document/category in text |
| Assessment/interview/offer | clipboard-check, calendar, file-signature | Never rely on glyph alone |
| Success/warning/error/info | check-circle, triangle-alert, circle-x, info | Status text required |
| Private/restricted | lock, shield | Explain scope in nearby copy |
| More actions | ellipsis | Accessible name includes object |

## API and behavior

Conceptual API: `Icon{name,size=20,tone='current',decorative=true,title?}`. Decorative icons use hidden semantics. Meaningful icons have an accessible name, though a visible text label is preferred. IconButton requires `aria-label`, tooltip, visible focus, and target size. Do not use emoji, filled/outline mixtures, arbitrary brand marks, or icons as illustrations.

## Evidence Rail

Rail icons represent stage category; state comes from icon + label + line treatment. Completed uses check, current uses ring/pointer, blocked uses alert, and pending uses clock. Candidate-facing labels must not reveal private evaluator or approval state.

## Decisions and accessibility

Lucide is recommended for breadth, consistency, and tree-shakeable React usage, subject to dependency approval. RTL-sensitive arrows must mirror where meaning is directional. Test at 200% zoom and Windows high contrast. See [Component Library](03_COMPONENT_LIBRARY.md) and [Accessibility](11_ACCESSIBILITY.md).

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| One outline family | Consistent optical language | Mixed filled/outline icons | Recommended |
| Lucide evaluation | Broad coherent set without claiming installation | Custom icon set | Decision Required | Initialization/bundle |
| Icons never carry status alone | Protects nonvisual and color-independent understanding | Icon-only statuses | Recommended | All domain components |
