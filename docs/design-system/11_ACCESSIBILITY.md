# Talvix Accessibility Standard

**Status:** Recommended target: WCAG 2.2 AA.

## Status legend

| Implemented | Recommended | Future | Decision Required |
| --- | --- | --- | --- |
| Backend privacy constraints | Requirements below | Formal conformance statement | Audit owner/toolchain |

## Scope

Accessibility is a release criterion for public, auth, candidate, organization, owner, and admin experiences. Automated checks supplement—not replace—keyboard, screen-reader, zoom, contrast, and usability review.

## Requirements

| Area | Requirement | Verification |
| --- | --- | --- |
| Keyboard | Every task complete without pointer; no trap except managed modal | Manual tab/arrow/Escape/Enter/Space paths |
| Focus | Visible `--focus-width` ring using `--color-focus`, with `--focus-offset`; logical order; restored after overlays | Manual + visual regression |
| Targets | Minimum 44×44 CSS px for interactive targets | Inspection |
| Semantics | Native elements, landmarks, one `h1`, ordered headings, labelled controls | Accessibility tree review |
| Contrast | 4.5:1 text, 3:1 large text/UI; test real glass backdrop | Contrast tooling + manual |
| Reflow | 320px/400% without loss or nonessential 2D scroll | Browser testing |
| Text | Resize to 200%; no clipping; input text 16px | Browser testing |
| Motion | Reduced-motion alternative; no necessary animation | OS setting test |
| Status | Text/icon/shape plus color; appropriate live-region priority | Screen-reader test |
| Errors | Summary + inline messages; focus summary after failed submit | Keyboard/screen-reader test |
| Media/files | Clear type/size constraints, progress, cancellation/retry | Workflow test |
| Charts | Summary, legend, non-color encodings, data table | Manual review |

## Complex workflows

PipelineBoard must have equivalent PipelineList and explicit keyboard stage movement with confirmation for consequential changes. Dragging is optional. EvidenceRail is an ordered list with visible state text. Assessment timers must be announced conservatively, offer extensions where policy allows, and never steal focus. Date/time uses locale plus timezone. Session expiry preserves safe drafts and explains recovery.

## Native semantics, ARIA, and keyboard contracts

No ARIA is better than incorrect ARIA. Start with native button, link, input, table, list, details, fieldset, dialog, and progress semantics; add ARIA only when native semantics cannot express the interaction. Accessible-name precedence is visible label first, then `aria-labelledby`, then `aria-label` for icon-only controls. `aria-describedby` references persistent help and current errors; it must not duplicate the label. Error text is visible and associated; `aria-invalid` supplements it.

| Pattern | Semantic/ARIA contract | Keyboard model | Announcement/testing | Status |
| --- | --- | --- | --- | --- |
| Dialog | Native dialog or conforming `role=dialog`, labelled and described; background inert | Tab contained; Escape closes unless destructive work requires explicit choice; restore trigger focus | Name/description and initial focus tested | Recommended |
| Combobox | Input + popup listbox with active-descendant or roving focus per chosen pattern | Type, arrows, Enter, Escape; Tab exits | Announce result count, selection, no results | Recommended; headless implementation Decision Required |
| Menu | Only short action sets; not site navigation | Arrow keys, Home/End, Enter/Space, Escape | Trigger expanded state; focus returns | Recommended |
| Tabs | `tablist/tab/tabpanel` with selected and ownership relationships | Left/right (or vertical up/down), Home/End; activation policy documented | Active tab and panel name tested | Recommended |
| Accordion | Button controls named region; `aria-expanded` | Tab reaches headers; Enter/Space toggles | Expanded state exposed | Recommended |
| Data table | Native table/caption/header association; avoid grid role unless cell interaction requires it | Tab only to interactive content; sorting buttons keyboard operable | Sort direction and updates announced | Recommended |
| Pipeline | PipelineList is equivalent primary path; board columns are labelled groups | Tab to card actions; explicit Move command; optional drag keyboard model only if complete | Move result announced politely; confirmation for consequence | Recommended |
| Timer | Visible text with restrained live updates | No special key capture | Announce threshold changes, not every second | Recommended |
| Async validation | Control description + error; summary on submit | Focus summary after failed submit, then linked fields | Polite for nonblocking, assertive only for immediate critical failure | Recommended |
| Toast/live region | Status for confirmations; alert only for urgent blocking failures | Actions reachable; timer pauses on focus | Avoid duplicate toast + inline announcement | Recommended |

## Privacy and accessible copy

Accessibility labels must not leak hidden data. Candidate assessment views exclude answers, explanations, hidden tests, and raw snapshots; interview views exclude private feedback, instructions, security, and audit data; offer views exclude approvals, snapshots, internal actors, and corrections. Error messages exclude credentials, provider metadata, signed URLs, checksums, and private notes.

## Testing gates

| Gate | Completion criterion |
| --- | --- |
| Component | Semantics, keyboard, focus, contrast, zoom, forced colors, reduced motion covered |
| Feature | Happy, loading, empty, error, permission, timeout, and validation paths reviewed |
| Release | Automated scan has no serious violations; manual critical journeys pass with at least one screen reader per supported OS |

## Decisions and rationale

Accessibility acceptance belongs in component APIs and feature definitions, not a final audit. Exact supported browser/screen-reader matrix and audit ownership are **Decision Required**. Cross-links: [Components](03_COMPONENT_LIBRARY.md), [Motion](05_MOTION_SYSTEM.md), [Color](07_COLOR_SYSTEM.md).

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| Native-first semantics | More robust across assistive technology | ARIA-first custom widgets | Recommended | Component primitives |
| Polite live regions are default | Prevents interruption overload | Assertive for all updates | Recommended | Async workflows |
| Headless package does not define the contract | Accessibility obligations survive dependency changes | Vendor-specific behavior | Recommended | Package evaluation |
