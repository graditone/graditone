# Feature Specification: Rapid Demo Flow Generation from a Goal

**Feature Branch**: `102-demo-flow-generation`  
**Created**: 2026-11-28  
**Status**: Draft  
**Input**: User description: "Explore the optimal workflow to create demo videos in Graditone. Right now, we have automated the creation of videos of Graditone but it is too slow to generate the yaml file describing how to implement in Graditone the steps to reproduce the video. The goal is to generate in <10s this yaml file so we can produce the video based on it later with a command. The main issue seems to be to find in the HTML DOM the different elements that we need to use to manage Graditone to reach the video goal."

## Clarifications

### Session 2026-11-28

- Q: When resolving a demo step to a real control, where should the element lookup read from? → A: Hybrid — a source-derived catalogue is the fast default; an on-demand live DOM/accessibility snapshot of the running app fills gaps and refreshes it.
- Q: When an author asks for a new demo flow, who or what turns the plain-language goal into the flow's ordered steps? → A: Agent-driven workflow + fast element-lookup tool — the demo author works in an agent session following a documented skill.
- Q: When should a generated step be treated as unresolved instead of being given a target control? → A: Only an unambiguous match resolves; anything ambiguous, missing, or matching several controls is flagged with candidates.
- Q: How should the app's controls be made discoverable — a maintained catalogue, or annotations on the elements themselves? → A: Annotate the demo-relevant controls in the app with correct ARIA (role + accessible name) plus a stable test handle; the catalogue becomes a derived index of that accessibility surface, guarded by an automated check. Scope: the controls the demos actually use.
- Q: What should count as the "representative set" of goals for the ten-second and first-attempt criteria? → A: The two existing flows (play-a-score, play-a-score-tempo) plus about three new single-plugin goals.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get a runnable flow draft from a described goal, in seconds (Priority: P1)

A demo author wants a new video. They describe the journey in plain language — for example, "open the Play Score plugin, choose Für Elise, start playback and raise the tempo while it plays". The author supplies that description and, within a few seconds, receives a flow file (the demo's single source of truth) with an identifier, a title, a description and an ordered list of steps. The file is a draft the author can review and commit; the existing demo command later turns it into the video.

**Why this priority**: This is the core value. Today producing the flow file is the slow, manual part that blocks every new demo. A fast, complete draft is the minimum useful slice, even if a step or two still need attention.

**Independent Test**: Supply a single-plugin goal in natural language and confirm a flow file appears in the flows area within the time budget, names the demo consistently, and contains an ordered step list whose actions are all from the existing step vocabulary. Run the existing video command on the draft to confirm it is accepted.

**Acceptance Scenarios**:

1. **Given** a plain-language goal for a single plugin journey, **When** the author submits it, **Then** a flow file is produced with an identifier, title, description and ordered steps, within the time budget in SC-001.
2. **Given** the produced flow file, **When** the existing video command is pointed at it, **Then** the flow is accepted without changes to the flow format or the video pipeline.
3. **Given** an author who supplies only a short, high-level goal, **When** generation runs, **Then** the flow still contains the intermediate steps needed to reach the goal on screen (opening the plugin, selecting the item, waiting for content to load), not only the first and last action.
4. **Given** a goal that looks like an existing demo, **When** generation runs, **Then** the new flow gets a distinct identifier and does not overwrite an existing flow.

---

### User Story 2 - Trust that each step points at a real control (Priority: P2)

The generated draft must act on the actual interface. For every interactive step, the author can see which on-screen control the step targets — a stable control hook, a control role/name, or a visible label — and never a guessed, position-based, or non-existent selector. When the goal refers to something the author cannot be matched to a real control with confidence, the draft says so plainly, names the step it could not resolve, and offers the closest candidate controls instead of inventing a selector.

**Why this priority**: Finding the right element in the interface is the stated bottleneck and the main reason the current workflow is slow. Selectors that only *look* plausible waste more time than a clearly flagged gap, because they fail later during capture. Honest, grounded steps are what make the draft trustworthy.

**Independent Test**: Generate flows for goals that (a) all resolve to existing controls and (b) include one step naming a control that does not exist. Confirm every interactive step in (a) targets a control that exists in the app, and that (b) explicitly flags the unresolved step with a reason and candidate controls instead of emitting a selector.

**Acceptance Scenarios**:

1. **Given** a step whose wording matches an existing control, **When** the flow is generated, **Then** the step targets that control through a stable hook or its role/accessible name, not through an absolute position or element order.
2. **Given** a step whose wording matches no control, **When** the flow is generated, **Then** the step is marked unresolved, the reason is stated, and the closest candidate controls are listed.
3. **Given** two controls with the same visible label on the same screen, **When** the flow is generated, **Then** the step disambiguates the intended control (for example by its location, role or owning screen) rather than matching whichever appears first.
4. **Given** a control that only becomes available after content loads, **When** the flow is generated, **Then** the step is preceded by the wait needed for that content, so the recorded flow does not race the app.
5. **Given** the same goal supplied twice, **When** both are generated, **Then** both drafts target the same controls (new controls added in between may be used, but existing targets are stable).

---

### User Story 3 - Keep authoring fast without producing the video (Priority: P3)

The author can produce and review many flow drafts quickly without paying the cost of recording a video each time. Producing the video stays a separate, slower command run on the chosen flow when the author is happy with it. Each generation also reports how it went — time taken, steps produced, steps resolved, steps unresolved, and what each step targets — so the author can judge the draft at a glance.

**Why this priority**: Separating fast authoring from slow capture is what makes the ten-second goal achievable and lets an author iterate on several drafts. It builds on the grounded steps of User Story 2 and is valuable even before every goal resolves perfectly.

**Independent Test**: Generate several drafts in a row and confirm each finishes within the time budget with no video produced; confirm each emits a generation summary listing resolved and unresolved steps and their targets. Then run the existing video command on one draft to confirm capture is unchanged.

**Acceptance Scenarios**:

1. **Given** the author has not produced any video, **When** they generate a flow, **Then** the flow is produced without starting a video capture.
2. **Given** a completed generation, **When** the author reads the result, **Then** it reports the time taken, the number of steps produced, which steps are resolved, which are unresolved, and the control each resolved step targets.
3. **Given** a draft the author accepts, **When** they run the existing video command on it, **Then** the video is produced exactly as for a hand-written flow, with no additional manual step.
4. **Given** a draft with an unresolved step, **When** the author fixes or replaces that step and re-runs the video command, **Then** no other part of the flow needs to change.

---

### Edge Cases

- **Goal names a control that does not exist or was renamed**: the step is flagged unresolved with candidates; the rest of the flow is still produced.
- **Goal is ambiguous or too vague** ("make it nicer"): generation produces the steps it can ground and clearly reports that it could not determine a concrete journey, rather than inventing actions.
- **Goal spans more than one plugin or screen**: the flow places the navigation steps between screens; if a transition cannot be grounded, it is flagged like any other unresolved step.
- **Control is not annotated**: the step is flagged unresolved, and the fix is to annotate the control (correct role + accessible name + test handle); the annotation is added and the index refreshed, rather than inventing a selector.
- **Duplicate visible labels** (for example "Play" on several surfaces): the step is disambiguated by owning screen and role, not by element order.
- **Localized interface**: with a non-primary demo language, steps still resolve through stable hooks where available and clearly report any step that depended on label text.
- **App is not reachable when generation runs**: generation fails fast with a clear message identifying that the element catalogue could not be read, rather than producing an empty or guessed flow.
- **Element catalogue is stale** after an interface change: a refresh (from source and/or a fresh live DOM/accessibility snapshot) updates it, and subsequently a previously unresolved step may resolve.
- **Goal requires a repeated or held interaction** (holding a control to repeat): the flow uses the matching existing action behaviour so the on-screen result matches the goal.
- **Goal requires waiting for slow content** (parsing/engraving a score): the flow inserts the necessary waits before acting on content that is not yet present.
- **Generated identifier collides** with an existing flow: a distinct identifier is chosen; no existing flow is overwritten.
- **Partially resolvable goal**: the flow is still emitted, with resolved steps usable and unresolved steps listed, so the author can complete it by hand.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept a demo goal expressed in natural language and produce a demo flow document from it through a documented, agent-driven workflow, without a formal grammar or structured input.
- **FR-002**: The produced flow MUST conform to the existing flow format and use only the existing step vocabulary and attributes, so the current video command runs it unchanged.
- **FR-003**: The produced flow MUST contain an identifier, a title, a description and an ordered list of steps that together describe the goal journey.
- **FR-004**: For a typical single-plugin goal, the system MUST produce the flow within ten seconds of the goal being submitted (measured from submission to the flow being written), without producing a video.
- **FR-005**: For every interactive step, the system MUST bind the step's wording to a concrete control of the application and express the target through a stable control hook or the control's role/accessible name, rather than the element's position or order on the page.
- **FR-006**: The system MUST NOT emit a guessed selector: a step resolves only when its wording maps to exactly one control (by stable hook, role/accessible name, or label). A step that is ambiguous, missing, or matches several controls MUST be marked unresolved, with the reason and the closest candidate controls named in the output.
- **FR-007**: Every demo-relevant control in the application MUST be annotated with a correct role and a meaningful accessible name (from its visible, localized label or an explicit accessible-name attribute) plus a stable test handle, so the application's own accessibility surface is the source of truth for the element lookup. The catalogue MUST be derived from these annotations and the existing end-to-end tests, and MAY be enriched from a live DOM/accessibility snapshot of the running application for controls the annotations cannot resolve.
- **FR-008**: The system MUST maintain a persistent index of the application's demo-relevant controls, derived from the annotations, reuse it across generations so repeated requests do not rescan the application, and provide a way to refresh it — from the annotations and/or a fresh live DOM/accessibility snapshot.
- **FR-009**: The system MUST order the steps so the goal is achieved on screen, including the intermediate navigation and selection steps implied by the goal.
- **FR-010**: The system MUST insert, where a step depends on content or a state that appears asynchronously, the wait needed so the resulting flow does not act before the application is ready.
- **FR-011**: The system MUST attach to each step the on-screen presentation that makes it readable in the finished video (a caption, and a hold where a state change or wait should be seen).
- **FR-012**: The system MUST choose a flow identifier, title and description consistent with the goal and MUST NOT collide with or overwrite an existing flow.
- **FR-013**: The system MUST report, for each generation, the time taken, the number of steps produced, which steps are resolved, which are unresolved, and the control each resolved step targets.
- **FR-014**: The system MUST leave the existing video pipeline and flow format unchanged: every existing flow MUST still run, and no new step action may be required.
- **FR-015**: Given the same goal on separate occasions, the system MUST produce flows that target the same controls, allowing for controls added in between.
- **FR-016**: When the application's controls cannot be read at all, the system MUST fail with a clear, actionable message rather than producing a flow with guessed or empty steps.
- **FR-017**: The system MUST include an automated check (a lint or test) that demo-relevant controls carry a stable role, accessible name and test handle, so annotated coverage cannot silently regress.

### Key Entities *(include if data involved)*

- **Demo Goal**: The natural-language description of the video the author wants, with any constraints they give (audience, plugin, locale). Input to generation.
- **Flow Document**: The deliverable — identifier, title, description, viewport and the ordered steps. The single source of truth the video command consumes.
- **Flow Step**: One ordered action in the flow: what to do (an action from the existing vocabulary), the control it targets or the condition it waits for, and the caption/hold that presents it on video.
- **Control Catalogue**: A derived index of the application's demo-relevant controls and how to identify each one (its role, accessible name, test handle and owning screen or plugin). Derived from the application's own annotations and tests, optionally enriched from a live DOM/accessibility snapshot; not hand-curated.
- **Element Binding**: The link between one goal phrase and one catalogue control, carrying whether the match is unambiguous and, when unresolved, the candidate controls and reason.
- **Generation Workflow**: The documented procedure and tools an agent follows to turn a Demo Goal into a Flow Document — interpreting the goal, looking up controls, ordering the steps, and emitting the Generation Report.
- **Generation Report**: The per-run summary: elapsed time, steps produced, resolved and unresolved counts with their targets, and any element gaps worth closing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a representative set of single-plugin goals (the two existing flows — play-a-score and play-a-score-tempo — plus about three new single-plugin goals), a complete flow draft is produced in under ten seconds (submission to file written) in at least 90% of runs.
- **SC-002**: For goals in that representative set whose steps all resolve, the generated flow runs end-to-end through the existing video command with zero selector-resolution failures on the first attempt in at least 90% of runs.
- **SC-003**: Zero unresolved steps are emitted as guessed selectors: for unresolved steps, 100% are explicitly flagged with a reason and candidate controls.
- **SC-004**: Authoring a demo flow drops from the current manual selector hunt (minutes) to a single generation step under ten seconds — at least a ten-fold reduction in authoring time.
- **SC-005**: The derived index resolves at least 95% of the demo-relevant controls on the primary demo surfaces, and a refresh reflects added or renamed controls.
- **SC-006**: For goals whose steps all resolve, the generated flow requires no manual edits before capture.
- **SC-007**: The existing flows continue to run and the existing video pipeline is unchanged: no existing flow breaks and no new step behaviour is introduced.
- **SC-008**: Every generation emits a report from which the author can tell, without reading the flow in full, how many steps are resolved and which controls they target.
- **SC-009**: 100% of demo-relevant controls are uniquely identifiable by a stable, accessible handle, enforced by an automated check that fails on regression.

## Assumptions

- The demo goal is written by the demo author in natural language; there is no structured or formal goal syntax to learn.
- Flow generation is performed by a demo author working in an agent session that follows the documented Generation Workflow and uses the element-lookup helper; it is not an unattended service.
- Target demos are single-plugin, largely linear journeys comparable to the two existing flows; multi-plugin goals are supported but are not the optimization target.
- The existing flow format and video command are the contract; this feature does not change the runner, the flow vocabulary or the capture and export steps.
- Generation is fast because element discovery reads a persistent catalogue derived from the application's annotations, instead of driving the running application on every request; producing a video (the slow part) stays a separate command.
- The application's own annotations are the source of truth: every demo-relevant control carries a correct role, a meaningful accessible name (its visible, localized label or an explicit accessible-name attribute) and a stable test handle. The catalogue is a derived index of those annotations, not a separately maintained file.
- Annotation scope is the controls the demos actually use — the plugin launcher and the plugin screens in the demo catalogue — not every interactive control in Graditone.
- The primary demo language is English; stable hooks are preferred over label text so a non-English demo still resolves wherever possible.
- The generated flow is a draft: the author reviews it, and may commit it or complete any flagged steps, before the video is produced.
- The ten-second target applies to producing the flow only, not to producing the resulting video.
- An existing demo flow overwrite never happens; the author chooses to replace an existing flow explicitly, outside this feature.

## Known Issues & Regression Tests *(if applicable)*

No issues recorded yet. This section will grow during implementation, deployment, or production use per Principle VII (Regression Prevention).
