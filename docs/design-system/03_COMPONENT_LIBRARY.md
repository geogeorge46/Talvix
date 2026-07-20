# Talvix Component Library

**Status:** Recommended inventory; none of these components is currently implemented.

## Status legend and scope

`Implemented` = repository-backed capability; `Recommended` = initial UI library; `Future` = deferred; `Decision Required` = package/product approval. API shapes below are conceptual TypeScript-like contracts, not code. All components consume [tokens](02_DESIGN_TOKENS.md).

## Primitives and controls

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Button / IconButton | Trigger action | `intent,size,icon,loading,disabled,onPress` | primary, secondary, quiet, danger | hover, focus, active, disabled, loading | Native button; name icon-only controls; 44px target | Primitive for all actions | Recommended |
| Link | Navigate | `to,external,download` | inline, standalone, subdued | current, visited, focus | Descriptive text; external cue | Router adapter | Recommended |
| TextField / TextArea | Text input | `label,name,value,hint,error,required` | standard, compact | empty, filled, invalid, disabled, read-only | Label association; error ID; no placeholder-only labels | Form primitive | Recommended |
| Select / Combobox | Choose/search options | `options,value,multiple,filterable` | select, autocomplete, multi | open, empty, loading, error | Keyboard listbox behavior; announce count | Headless behavior decision pending | Decision Required |
| Checkbox / Radio / Switch | Boolean or exclusive choice | `checked,value,label,description` | checkbox, radio group, switch | mixed, disabled, invalid | Native semantics; switch only for immediate settings | Form primitive | Recommended |
| Date/TimeField | Schedule or filter | `value,min,max,timezone` | date, time, range | invalid, unavailable | Locale input, text fallback, explicit timezone | Shared scheduling control | Recommended |
| FileUpload | Select and track file | `accept,maxSize,multiple,onUpload` | dropzone, compact | idle, uploading, success, failed, rejected | Real input; keyboard action; progress text | Domain wrapper supplies server policy | Recommended |
| SearchField | Query lists | `query,onChange,onSubmit,onClear` | global, scoped | typing, loading, no-results | Search landmark/label; results announcement | Shared query control | Recommended |

## Surfaces and form composition

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Card | Group a coherent summary without card-grid defaulting | `as,heading,actions,tone,padding` | plain, bordered, interactive, metric | default, hover/focus when interactive, disabled | Semantic element chosen by context; whole-card link has one focus target | Surface primitive; prefer sections/separators for dense pages | Recommended |
| Form | Coordinate submission and error focus | `onSubmit,status,errorSummaryId` | standard, wizard, autosave | pristine, dirty, submitting, succeeded, failed | Native form; focus error summary after failure; prevent duplicate submit | Form shell used by all editors | Recommended |
| FormField | Bind label, control, hint and error | `name,label,description,error,required,children` | standard, inline, compact | valid, invalid, disabled, read-only | Deterministic IDs; `aria-describedby`; required conveyed in text | Wraps input primitives without owning business validation | Recommended |
| FormSection | Group related fields | `legend,description,actions,children` | fieldset, visual section | default, disabled | `fieldset/legend` for related controls; heading otherwise | Editors and settings | Recommended |
| ErrorSummary | Collect submission errors | `title,errors,targetByField` | page, dialog | visible, updating | Focused heading; links move focus to invalid control; live only after submit | One implementation across forms | Recommended |
| Stepper | Explain multistep form progress | `steps,currentId,completedIds` | horizontal summary, vertical | current, completed, blocked | Ordered list; step labels and current state | Uses EvidenceRail visuals where chronology matters | Recommended |

## Feedback, disclosure, and navigation

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alert | Persistent message | `tone,title,actions,dismissible` | info, success, warning, danger | static, dismissed | Role alert only when urgent | Primitive | Recommended |
| Toast | Brief mutation feedback | `tone,message,action,duration` | neutral, success, danger | queued, paused | Polite live region; persist errors until dismissed | Global provider | Recommended |
| Dialog / ConfirmDialog | Focused task/confirmation | `open,title,description,onClose` | modal, destructive | opening, busy, error | Focus trap/restore, Escape, labelled dialog | Headless primitive decision pending | Decision Required |
| Drawer | Responsive secondary task | `side,open,title` | end, bottom | open, busy | Dialog semantics when modal | Composite over dialog | Recommended |
| Tooltip | Supplemental label | `content,placement` | default | delayed, open | Not sole information source; keyboard trigger | Primitive | Recommended |
| Disclosure / Accordion | Reveal supporting content | `items,openIds,multiple` | bordered, plain | collapsed, expanded | Button + `aria-expanded` | Primitive | Recommended |
| Tabs | Peer views | `items,activeId,onChange` | underline, segmented | active, disabled | Arrow-key tablist; URL-backed for pages | Navigation pattern | Recommended |
| Breadcrumbs | Location context | `items` | standard | current | Nav label; current page annotation | Layout component | Recommended |
| Pagination | Bounded pages | `page,total,onChange` | numbered, compact | first/last/loading | Nav label; current page | List pattern | Recommended |
| Menu | Compact actions | `items,trigger,onAction` | action, selection | open, disabled | Menu keyboard model; use list of links for nav | Headless primitive decision pending | Decision Required |

## Data and domain patterns

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DataTable | Compare structured rows | `columns,rows,sort,selection` | standard, compact | loading, empty, error, partial | Caption, headers, keyboard operability; cards only when semantics remain | Shared primitive + domain cells | Recommended |
| List / DescriptionList | Scan records/attributes | `items,renderItem` | divided, interactive, definition | loading, empty, error | Native list or dl semantics | Preferred mobile table alternative | Recommended |
| Badge / StatusTag | Compact state | `tone,label,icon` | neutral and semantic | static | Text/icon plus color | Central status mapping | Recommended |
| Avatar | Identify actor/org | `name,src,size` | person, company | image, initials, broken | Useful alt or decorative beside name | Primitive | Recommended |
| Progress / Meter | Completion or bounded value | `value,max,label` | bar, meter, steps | determinate, indeterminate | Native/ARIA value and text | Primitive | Recommended |
| Skeleton / Spinner | Loading indication | `shape,label` | text, block, inline | loading | `aria-busy`; spinner has accessible label | Prefer skeleton for stable layout | Recommended |
| EmptyState | Explain absence and next action | `title,body,action,illustration?` | first-use, filtered, permission | empty | Heading and logical action order | Shared composition | Recommended |
| ErrorState | Explain failure and recovery | `title,detail,retry,referenceId?` | inline, section, page | retrying | Focusable heading for page errors; no secrets | Shared composition | Recommended |
| EvidenceRail | Show ordered hiring evidence | `items,orientation,currentId,density` | vertical, horizontal, compact | current, complete, blocked, pending | Ordered list; state text/icon; list fallback | Shared across applications, assessments, interviews, offers, verification | Recommended |
| PipelineBoard | Move/inspect applications | `columns,items,onMove` | board, read-only | loading, empty, error | Full keyboard move actions and equivalent PipelineList | Domain composition | Recommended |
| PipelineList | Accessible pipeline alternative | `rows,stageFilter,onStageChange` | table, list | same as board | Primary equivalent, not a degraded afterthought | Shares query/mutations with board | Recommended |
| Metric / ChartFrame | Aggregate admin data | `title,value,series,tableData` | KPI, line, bar, funnel | loading, empty, error | Summary, legend, patterns, downloadable table | Analytics composition | Recommended |

**Timeline mapping:** `EvidenceRail` is the canonical Talvix Timeline. Use a generic timeline name only in content language; component ownership and API remain `EvidenceRail`.

## Candidate and job components

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CandidateSummary | Scan candidate-safe identity and evidence | `candidate,skills,match?,actions,visibility` | row, compact, shortlist | loading, unavailable, restricted | Heading/name, structured list, explicit visibility label | Recruiter lists; safe fields supplied by adapter | Recommended UI / Implemented API domain |
| CandidateProfileHeader | Orient profile and primary actions | `name,headline,avatar,completion,actions` | own, recruiter-safe | incomplete, private, loading | `h1`; avatar alternative; completion meter label | Candidate profile/detail | Recommended UI / Implemented API domain |
| CandidateEvidenceSection | Present experience/projects/certifications | `title,items,editable` | timeline, list | empty, loading, error | Section heading and native list; edit controls named by item | Shared profile evidence pattern | Recommended UI / Implemented API domain |
| ProfileCompletion | Explain missing profile evidence | `value,tasks` | compact, detailed | complete, incomplete | Meter plus remaining-task list | Dashboard/profile | Recommended |
| JobSummary | Scan a published or managed role | `job,company,status,match?,actions` | public row, managed row, saved | loading, closed, pending-review | Heading link; metadata list; status text | Public/candidate/org lists | Recommended UI / Implemented API domain |
| JobMetadata | Present location/type/skills/deadline | `items,salaryVisibility` | inline, definition-list | partial, unavailable | `dl`; no icon-only facts | Job details and application context | Recommended UI / Implemented API domain |
| JobFilters | Control URL-backed discovery | `filters,counts,onChange,onClear` | inline, drawer | loading, applied, no-results | Fieldset groups; applied summary; result count announcement | Jobs and managed-jobs lists | Recommended |
| ApplicationAction | Apply/withdraw with consequence copy | `eligibility,status,onApply,onWithdraw` | apply, withdraw | blocked, pending, success, error | Reason text; confirmation; focus recovery | Job/application detail | Recommended UI / Implemented API domain |

## Assessment components

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AssessmentSummary | Show assignment-safe metadata | `title,status,dueAt,duration,attempts` | candidate, recruiter | upcoming, active, expired, cancelled | Status and timezone text; actions named | Assignment lists | Recommended UI / Implemented API domain |
| AssessmentTimer | Communicate remaining time | `endsAt,warningThresholds,onExpire` | elapsed, remaining | normal, warning, expired, paused-if-policy | Visible text; sparing announcements; never focus-stealing | Attempt workspace only | Recommended UI / Implemented API domain |
| QuestionNavigator | Navigate allowed questions | `items,currentId,answeredIds,flaggedIds` | grid, list | current, answered, flagged, unavailable | Buttons named by number/state; logical sequence | Objective attempt workspace | Recommended UI / Implemented API domain |
| AssessmentQuestion | Render candidate-safe prompt/control | `prompt,type,value,options,onChange` | objective, text, attachment-policy | unanswered, answered, invalid, saving | Group label/instructions; keyboard controls; autosave status | Type renderers behind safe contract | Recommended UI / Implemented API domain |
| AssessmentAttachment | Enforce immutable assignment policy | `policy,files,onUpload,onRemove` | disabled, enabled | uploading, rejected, complete, failed | Server-derived constraints and progress announced | Wrapper over FileUpload | Recommended UI / Implemented API domain |
| SafeAssessmentResult | Show allowed score/outcome only | `status,score?,summary?,releasedAt?` | pending, released, withheld | loading, unavailable, error | Clear heading/status; no hidden-answer affordance | Candidate-only DTO/component | Recommended UI / Implemented API domain |

## Interview components

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| InterviewProcessSummary | Show process/next round | `process,status,nextEvent,actions` | candidate-safe, recruiter | scheduled, awaiting, complete, cancelled | Stage labels and times; no private data in candidate variant | Lists/dashboard | Recommended UI / Implemented API domain |
| InterviewRound | Describe one round | `name,type,status,schedule,participants?` | candidate-safe, recruiter | unscheduled, scheduled, completed | Heading in ordered structure; timezone | EvidenceRail item composition | Recommended UI / Implemented API domain |
| AvailabilityGrid | Collect availability windows | `range,timezone,slots,onChange` | candidate, interviewer | available, selected, unavailable, conflict | Keyboard list/table alternative; timezone and selection text | Shared scheduling pattern | Recommended UI / Implemented API domain |
| InterviewScheduleCard | Confirm appointment | `startsAt,duration,locationSafe,actions` | upcoming, past | rescheduled, cancelled, loading | Semantic time; calendar action labelled; no provider secrets | Candidate/recruiter schedule | Recommended UI / Implemented API domain |
| Scorecard | Capture structured evaluator feedback | `rubric,ratings,notes,onSubmit` | draft, read-only, admin-correction | saving, invalid, submitted, reopened | Fieldsets per criterion; error summary; keyboard ratings | Recruiter-only; never reused for candidate view | Recommended UI / Implemented API domain |

## Offer, organization, notification, and analytics components

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CandidateOfferSummary | Show safe terms and deadline | `offer,status,termsSafe,expiresAt,actions` | list, detail | sent, viewed, negotiation, accepted, declined, expired, withdrawn | Definition list, timezone, consequence copy | Candidate-safe adapter only | Recommended UI / Implemented API domain |
| OfferRevisionRail | Show candidate-safe revisions | `revisions,currentId` | candidate-safe, internal | superseded, current | EvidenceRail ordered list; candidate version excludes actors/corrections | Specialized EvidenceRail | Recommended UI / Implemented API domain |
| CompanyVerificationState | Explain governance state/next action | `status,reasonsSafe?,actions` | recruiter, admin | pending, verified, rejected, suspended | Status not color-only; actionable heading | Company/admin | Recommended UI / Implemented API domain |
| PermissionMatrix | Review persisted team permissions | `members,capabilities,onChange` | owner/manage, read-only | loading, dirty, conflict, denied | Table headers; per-row controls; change summary | Team management only | Recommended UI / Implemented API domain |
| NotificationItem | Present safe event and action | `notification,read,onOpen` | standard, high-priority | unread, read, stale | Article/list item; meaningful link; priority text | Inbox and popover | Recommended UI / Implemented API domain |
| AnalyticsDashboard | Compose aggregate reporting | `metrics,charts,filters,exportAction` | platform, domain | loading, partial, empty, error | Landmarks, heading hierarchy, table alternatives | Admin aggregate analytics | Recommended UI / Implemented API domain |
| FunnelChart | Show stages ever reached | `stages,counts,rates,tableData` | funnel, horizontal bars | loading, zero, error | Explain ever-reached definition; patterns and table | ChartFrame specialization | Recommended UI / Implemented API domain |

## Future assistance components

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AIDisclosure | Identify generated assistance and limitations | `modelLabel,generatedAt,limitations` | inline, panel | available, outdated | Plain-language disclosure; not tooltip-only | Any approved AI surface | Future / API not implemented |
| AIEvidenceList | Cite evidence behind assistance | `items,confidence?,onInspect` | summary, detailed | partial, unavailable | Ordered sources, uncertainty in text, keyboard inspection | Future explainability primitive | Future / API not implemented |
| AICorrectionControl | Let user contest/correct output | `value,onCorrect,onDismiss` | feedback, correction | submitting, accepted, failed | Labelled form and confirmation; no coercion | Future human-control pattern | Future / API not implemented |
| GitHubEvidence | Show consented repository evidence | `connection,items,consent,onDisconnect` | candidate, recruiter-safe | disconnected, syncing, stale, error | Consent/state text and revocation path | Isolated future module | Future / API not implemented |

## Shell and overlays

| Component | Purpose | Props/API shape | Variants | States | Accessibility | Reuse strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AppShell | Global workspace frame | `navigation,header,content,contextRail` | candidate, org, admin | loading permissions, ready | Landmarks, skip link, reflow | One shell with configurations | Recommended |
| SideNav / MobileNav | Primary navigation | `items,current,collapsed` | fixed, drawer | active, hidden by permission | Native nav; current page; focus restoration | Shell primitive | Recommended |
| PageHeader / Toolbar | Page identity/actions | `title,meta,actions` | standard, dense | wrapping, sticky | Correct heading order; actions remain reachable | Layout composition | Recommended |
| Popover | Anchored utility | `open,anchor,content` | nonmodal | open, loading | Managed focus and dismissal | Headless primitive decision pending | Decision Required |

## Privacy contracts

Candidate assessment UI accepts only safe result DTOs: never answers, explanations, hidden tests, or raw snapshots. Candidate interview components never accept private feedback, instructions, security details, or audit data. Candidate offer components never accept approval data, snapshots, internal actors, or corrections. Enforce these boundaries in service adapters and fixture review, not conditional hiding alone.

## Accessibility implications

Components ship with keyboard, focus, zoom, reduced-motion, touch-target, loading, empty, error, and disabled contracts. A semantic headless package and Lucide are **Recommended dependencies, not installed** and require evaluation. See [Accessibility](11_ACCESSIBILITY.md) and [Frontend Guidelines](14_FRONTEND_GUIDELINES.md).

## Decision log

| Decision | Rationale | Alternative | Status | Impact |
| --- | --- | --- | --- | --- |
| EvidenceRail is the Timeline implementation | Product-specific evidence language with reusable semantics | Generic Timeline component | Recommended | Applications, assessments, interviews, offers, verification |
| Candidate-safe components use separate adapters | Conditional hiding can leak private fields | Shared recruiter view with flags | Recommended | Service and test architecture |
| Domain tables are compositions over primitives | Avoids duplicate keyboard/focus behavior | Feature-local controls | Recommended | All feature modules |
