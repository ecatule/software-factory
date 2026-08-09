# Feature Specification: AI Software Factory — Core Platform

**Feature Branch**: `001-ai-software-factory`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "documentos iniciais/doc-specify.md — AI Software Factory Product Specification: a platform to manage and automate a software factory using AI agents and Spec-Driven Development (SDD), controlling a demand's lifecycle from intake through implementation and Pull Request, with full traceability, and integrating (as replaceable providers) Monday for demand intake, GitHub for version control, ChatGPT/Claude as LLMs, and Spec Kit for SDD."

## Clarifications

### Session 2026-08-07

- Q: How quickly must the demand cockpit reflect a stage's result after that stage finishes running? → A: Under 5 seconds
- Q: What uptime/availability expectation should the platform meet, given it gates every team's software delivery pipeline? → A: Business hours, best-effort; off-hours maintenance windows are acceptable
- Q: When a demand that was already imported changes upstream (e.g. edited in Monday), what should the platform do? → A: Ignore upstream changes after import — the platform becomes the sole source of truth for that demand once imported
- Q: How many demands should the platform actively process at the same time (in development/testing/agent-execution stages) for MVP? → A: A handful at a time, 2-10

## User Scenarios & Testing *(mandatory)*

<!--
  User stories are prioritized as independently testable/deployable slices.
  P1 covers the specification-and-tracking foundation (source doc's MVP 1): a demand can be
  taken from intake through an approved technical plan and tracked end-to-end, with no code
  changes yet. P2 covers the automated-implementation slice (source doc's MVP 2): the platform
  writes code, tests it, and opens a Pull Request. Each story is independently testable and
  independently deployable — P1 delivers value (controlled, traceable specification) even if
  P2 never ships.
-->

### User Story 1 - Demand intake and tracking (Priority: P1)

An analyst needs a demand (bug, feature, improvement, task, or technical debt item) that
originates outside the platform to enter the platform as a trackable record, associated with
its client and project, so that its progress can be followed from a single place.

**Why this priority**: Nothing else in the system exists without a demand. This is the
entry point and the anchor for all traceability.

**Independent Test**: Create a demand from an external source, confirm it appears in the
platform with client, project, type, status, and current stage populated, and that its status
can be queried at any time.

**Acceptance Scenarios**:

1. **Given** a demand exists in the upstream demand source, **When** it is imported into the
   platform, **Then** it appears with an internal identifier, its external identifier, title,
   description, type, priority, client, project, origin, status, and current stage.
2. **Given** a demand has been imported, **When** a user views it, **Then** its full change
   history (who changed what, and when) is visible.

---

### User Story 2 - Specification pipeline (Priority: P1)

An analyst needs a demand to move through the standard Spec-Driven Development pipeline
(Specify → Clarify → Plan → Checklist → Tasks → Analyze) with each step's output captured and
attributed, so that implementation is always grounded in an approved specification rather than
ad-hoc interpretation.

**Why this priority**: This is the platform's core value proposition — turning an
unstructured demand into a structured, reviewable specification before any code is written.

**Independent Test**: Run each SDD stage for a demand in order and confirm each stage
produces its expected document, the document is attributed to the user, agent, LLM, and
execution that produced it, and the demand's current stage advances accordingly.

**Acceptance Scenarios**:

1. **Given** a newly imported demand, **When** the Specify stage runs, **Then** a
   specification document is produced and the demand's stage advances to Specification.
2. **Given** a specification exists, **When** the Clarify stage runs, **Then** clarifying
   questions and their answers are captured and folded into the specification.
3. **Given** a clarified specification, **When** the Plan, Checklist, Tasks, and Analyze
   stages run in sequence, **Then** each produces its corresponding document and the demand's
   stage reflects the last stage completed.
4. **Given** any SDD stage execution, **When** it completes, **Then** the user, agent, LLM,
   and execution that performed it are recorded against the resulting document.

---

### User Story 3 - Specification versioning and review (Priority: P1)

An analyst or reviewer needs to edit a specification document, save it as a new version
without losing prior versions, and compare or restore any past version, so that specification
changes are safe, reviewable, and never silently destructive.

**Why this priority**: Specifications are the contract for implementation; losing or
silently overwriting them undermines the entire traceability guarantee.

**Independent Test**: Edit a specification document, save it, confirm a new version is
created with the prior version still intact and viewable, then restore the prior version and
confirm it becomes the current content while the edited version remains in history.

**Acceptance Scenarios**:

1. **Given** an existing specification document, **When** a user edits and saves it, **Then**
   a new version is created and the previous version remains retrievable.
2. **Given** a specification with multiple versions, **When** a user requests a comparison,
   **Then** the differences between any two versions are shown.
3. **Given** a specification with multiple versions, **When** a user restores an older
   version, **Then** it becomes the current version without deleting the version history.
4. **Given** any specification version, **When** a user inspects it, **Then** its author,
   producing agent, LLM, execution, and reason for change are visible.

---

### User Story 4 - Artifact identification and workspace creation (Priority: P1)

An analyst needs the platform to identify the logical software artifacts (frontend, backend,
database, etc.) a demand will touch and automatically create an isolated workspace for the
demand, so that implementation work has a well-defined, contained starting point.

**Why this priority**: Without a bounded, isolated workspace and an explicit artifact list,
the implementation stage has no defined scope to work within.

**Independent Test**: Approve a demand's plan, confirm the platform creates a workspace
containing only a specifications area and an artifacts area, and confirm each identified
artifact appears with its type, technology, and initially expected files.

**Acceptance Scenarios**:

1. **Given** an approved plan for a demand, **When** the workspace is created, **Then** it
   contains exactly two areas: one holding only SDD specification documents, and one holding
   only the demand's artifacts — no other content is placed at that same level.
2. **Given** a demand's plan identifies multiple artifacts, **When** the workspace is
   created, **Then** each artifact is represented with its own name, type, technology, and
   list of files expected to be impacted.
3. **Given** two artifacts belong to the same underlying code repository, **When** the
   workspace is created, **Then** both artifacts are linked to that one repository rather than
   assuming a one-artifact-to-one-repository relationship.

---

### User Story 5 - Demand cockpit (Priority: P1)

A stakeholder needs a single view of a demand showing its workflow progress, workspace,
artifacts, specifications, and timeline, so that anyone can understand a demand's current
state without digging through multiple systems.

**Why this priority**: Traceability and control are only useful if they are visible; the
cockpit is what makes the rest of P1 actionable for humans.

**Independent Test**: Open the cockpit for a demand that has progressed through several SDD
stages and confirm workflow progress, workspace contents, artifacts, specifications, and a
chronological timeline of events are all present and consistent with the demand's actual
state.

**Acceptance Scenarios**:

1. **Given** a demand that has completed some SDD stages, **When** its cockpit is opened,
   **Then** completed, current, and pending stages are all distinguishable.
2. **Given** a demand with a workspace and artifacts, **When** its cockpit is opened,
   **Then** the workspace structure and each artifact's status are shown.
3. **Given** a demand with recorded events, **When** its cockpit is opened, **Then** a
   timeline shows each event with a timestamp, in chronological order.

---

### User Story 6 - Automated implementation (Priority: P2)

A developer agent needs to receive a demand's workspace, specifications, tasks, and artifact
scope, and implement the planned changes within that scope, so that routine implementation
work can be automated once the specification is approved.

**Why this priority**: This is the first slice that produces code, building directly on the
P1 foundation; it has no value without P1 already in place.

**Independent Test**: Provide the developer agent a demand's workspace and approved tasks,
run it, and confirm it produces file changes limited to (or explicitly justified beyond) the
artifacts' expected files.

**Acceptance Scenarios**:

1. **Given** a demand with an approved plan, tasks, and identified artifacts, **When** the
   developer agent runs, **Then** it implements changes to the expected files of the relevant
   artifacts.
2. **Given** the developer agent discovers it needs to change a file that was not in the
   original expected list, **When** it makes that change, **Then** the file is registered
   against the artifact along with a justification, and the change history is preserved.

---

### User Story 7 - Automated testing and Test Gate (Priority: P2)

The platform needs to run a project's required automated tests after implementation and
block any commit while required tests are failing, so that no untested change reaches a
repository.

**Why this priority**: This is the safety control that makes automated implementation
(User Story 6) trustworthy enough to allow a commit to happen at all.

**Independent Test**: Run the required tests for a demand's implementation with a
deliberately failing test present, and confirm no commit occurs and the demand is marked
accordingly; then fix the failure, re-run, and confirm the commit is allowed to proceed.

**Acceptance Scenarios**:

1. **Given** a project with required test suites configured, **When** implementation
   finishes, **Then** all required suites run and their results (passed, failed, skipped,
   duration, coverage) are recorded.
2. **Given** at least one required test fails, **When** the Test Gate evaluates the result,
   **Then** the demand is marked as failed and no commit is created.
3. **Given** all required tests pass, **When** the Test Gate evaluates the result, **Then**
   the demand is allowed to proceed to commit.

---

### User Story 8 - Commit, push, and Pull Request (Priority: P2)

The platform needs to commit the implemented changes, push them, and open a Pull Request
pre-filled with the demand's context once the Test Gate passes, so that a human reviewer
receives a ready-to-review change without manual assembly.

**Why this priority**: This is the terminal action of the automated flow and the point at
which the platform's output re-enters the normal human review process.

**Independent Test**: Take a demand that has passed the Test Gate, let the platform commit,
push, and create the Pull Request, and confirm the PR contains the demand's title,
description, summary, artifacts, changed files, test results, and risk notes.

**Acceptance Scenarios**:

1. **Given** a demand has passed the Test Gate, **When** the commit step runs, **Then** a
   commit is created that is traceable back to the demand, its artifact(s), its task(s), and
   the test execution that authorized it.
2. **Given** a commit has been pushed, **When** the Pull Request is created, **Then** it
   includes the demand reference, a summary, the affected artifacts, the changed files, the
   test results, and any noted risks.

---

### User Story 9 - Git activity tracking (Priority: P2)

A stakeholder needs to see, per demand, which branch, commits, Pull Request, and checks are
associated with it, so that Git activity is understood in the context of the demand rather
than only in the code host.

**Why this priority**: Completes the cockpit view once code changes exist; without it, Git
activity from User Stories 6–8 would be invisible inside the platform.

**Independent Test**: After a demand has produced commits and a Pull Request, open its Git
view and confirm branch, commit list, Pull Request status, and check results are all shown
and match the code host's actual state.

**Acceptance Scenarios**:

1. **Given** a demand has an associated branch, **When** its Git view is opened, **Then**
   the branch name and naming pattern are shown.
2. **Given** a demand has commits and an open Pull Request, **When** its Git view is opened,
   **Then** the commits, the Pull Request's status, and its checks are shown.

---

### Edge Cases

- What happens when two artifacts in the same demand belong to the same code repository?
  The platform must associate both artifacts with that one repository and use a single branch
  for it, rather than creating duplicate clones or duplicate branches.
- What happens when the developer agent finds a file that must change but was not part of the
  originally planned scope? The file must be registered against the artifact with an explicit
  justification, and the discovery must be visible in the demand's history.
- What happens when a required test fails during the Test Gate? The commit must not happen,
  and the demand must move to a failed state that a human can act on.
- What happens when two people (or a person and an agent) try to save changes to the same
  specification version at the same time? The later save must be rejected or reconciled
  based on version, not silently overwrite the earlier one.
- What happens when a configured LLM or code-repository provider is unavailable when an
  agent execution is requested? The execution must be marked as failed with the reason
  recorded, and it must be safely retryable once the provider is available again.
- What happens when a demand needs to be reprocessed through a specification stage after
  changes upstream (e.g., the requirement changed)? A new version must be created; the prior
  specification and its version history must remain intact.
- What happens when the external demand source item is edited after the demand has already
  been imported? The platform must not automatically pull in that upstream change — the
  imported demand is authoritative from that point on. The prior edge case (reprocessing a
  specification stage) is about a deliberate, manual action inside the platform and is
  unaffected by this.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow demands to be imported from an external demand source and
  represented internally with an internal identifier, external identifier, title,
  description, type, priority, client, project, origin, status, current stage, responsible
  party, relevant dates, and change history.
- **FR-002**: The system MUST support at least the demand types BUG, FEATURE, IMPROVEMENT,
  TASK, and TECHNICAL_DEBT.
- **FR-003**: The system MUST access the external demand source only through a replaceable
  demand-source abstraction, so that a different demand source can be substituted without
  changing how demands are processed once inside the platform.
- **FR-004**: The system MUST drive each demand through a defined workflow of stages
  (at minimum: intake, specification, clarification, planning, checklist, tasks, analysis,
  ready-for-development, development, testing, commit, pull-request) plus the exception
  states blocked, failed, and cancelled.
- **FR-005**: The system MUST allow the workflow to be extended with additional stages in the
  future without requiring changes to demands already in progress.
- **FR-006**: The system MUST run the specification pipeline (Specify, Clarify, Plan,
  Checklist, Tasks, Analyze) for a demand and persist the document each stage produces.
- **FR-007**: The system MUST record, for every specification document produced, which user
  (if any), which agent, which LLM, and which execution produced it.
- **FR-008**: The system MUST access LLMs only through a replaceable LLM abstraction, and
  MUST allow the LLM used at each pipeline stage to be configured independently (e.g. a
  different LLM for specification than for implementation).
- **FR-009**: The system MUST run the specification pipeline only through a replaceable SDD
  abstraction, so the underlying SDD tooling can be substituted without changing how demands
  move through the pipeline.
- **FR-010**: The system MUST never overwrite a specification document; every edit MUST
  create a new version while preserving all prior versions.
- **FR-011**: The system MUST allow any two versions of a specification document to be
  compared, and any prior version to be restored as the current version without deleting
  version history.
- **FR-012**: The system MUST record, for every specification version, the acting user, the
  acting agent, the LLM used, the date, the execution, the reason for the change, and the
  content.
- **FR-013**: The system MUST create an isolated workspace for a demand once its plan is
  approved, containing exactly two areas: one restricted to SDD specification documents, and
  one restricted to the demand's code artifacts.
- **FR-014**: The system MUST prevent a code repository from being placed at the same level
  as the specifications area within a demand's workspace.
- **FR-015**: The system MUST represent each logical component touched by a demand as an
  artifact with a name, type, description, technology, path, associated repository, and
  status.
- **FR-016**: The system MUST support an artifact being associated with a repository, and a
  repository being associated with multiple artifacts, without assuming a one-to-one
  relationship between artifacts and repositories.
- **FR-017**: The system MUST track, for each artifact, the files expected to be impacted,
  and MUST allow additional files to be registered later as MODIFIED, ADDED, REMOVED, or
  DISCOVERED, each with a reason when discovered outside the original plan.
- **FR-018**: The system MUST access code repositories only through a replaceable
  code-repository abstraction, so a different code host can be substituted without changing
  how branches, commits, or Pull Requests are produced.
- **FR-019**: The system MUST create a branch for a demand automatically, following a
  configurable per-project naming policy, and MUST reuse a single branch when multiple
  artifacts share the same repository.
- **FR-020**: The system MUST run a project's configured automated tests after
  implementation and record, per run, its status, passed/failed/skipped counts, duration,
  coverage, and output.
- **FR-021**: The system MUST block any commit for a demand while any of the project's
  required tests are failing.
- **FR-022**: The system MUST create a commit and push it only after all required tests
  pass, and MUST link the resulting commit to the originating demand, artifact(s), task(s),
  and test execution.
- **FR-023**: The system MUST automatically create a Pull Request after a successful push,
  pre-filled with the demand reference, a summary, the affected artifacts, the changed files,
  the test results, and any identified risks.
- **FR-024**: The system MUST allow, for any demand, the full traceability chain to be
  retrieved: client, project, requirement, specification and its version, workspace,
  artifacts and their repositories, branch, files, tasks, responsible agent and LLM, commits,
  tests, Pull Request, and who performed each action and when.
- **FR-025**: The system MUST record an audit entry for every critical operation (at minimum:
  specification changes, workflow transitions, workspace creation, commits, and Pull Request
  creation), capturing the acting user or agent, the action, the affected entity, and a
  timestamp.
- **FR-026**: The system MUST restrict access to demands, specifications, workspaces, and
  administrative functions according to the acting user's role.
- **FR-027**: The system MUST provide a single view (cockpit) per demand showing its
  workflow progress, workspace, artifacts, specifications, Git activity, test results, and
  timeline.
- **FR-028**: The system MUST NOT automatically re-sync a demand's fields from the external
  demand source after initial import; the imported record is authoritative from that point
  on, and any re-alignment with upstream changes MUST be a deliberate, manual action rather
  than an automatic background sync.

### Key Entities

- **Client**: An organization on whose behalf demands are raised; may have multiple projects.
- **Project**: A body of work for a client, with its own repositories, technologies,
  environments, branch strategy, and required tests.
- **Demand**: The central unit of work — a bug, feature, improvement, task, or technical-debt
  item — tracked from intake through Pull Request, always associated with one client and one
  project.
- **DemandWorkspace**: The isolated working area created for a single demand, containing a
  specifications area and an artifacts area.
- **Specification / SpecificationVersion**: The versioned documents (spec, plan, research,
  data model, checklist, tasks, analysis) produced for a demand; every change creates a new
  version and none are ever overwritten.
- **Artifact**: A logical software component (e.g. a screen, an API, a database) involved in
  a demand's implementation, associated with one or more repositories.
- **ArtifactFile**: A specific file impacted by an artifact's implementation, with a change
  type (modified, added, removed, discovered) and, when discovered outside the original plan,
  a justification.
- **Workflow / WorkflowStage / WorkflowTransition**: The extensible sequence of stages a
  demand moves through, plus the transitions allowed between them.
- **Agent / AgentExecution**: An AI actor (e.g. the specification agent, the developer agent)
  and a specific run of that actor against a demand, with its inputs, outputs, and status.
- **Provider / ProviderConfiguration**: A replaceable integration point (demand source, code
  repository host, LLM, SDD tooling, storage) and its per-project configuration.
- **Repository / Branch / Commit / PullRequest**: The Git-level entities associated with a
  demand's implementation, linked back to the demand and its artifacts.
- **TestExecution / TestResult**: A run of a project's automated tests against a demand's
  implementation and its outcome.
- **AuditLog**: A record of a critical action taken on the platform, including who took it,
  what it affected, and when.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A demand can be taken from intake through an approved technical plan with every
  intermediate stage visible in the cockpit, with no step's output ever lost or silently
  overwritten.
- **SC-002**: For any demand, 100% of its specification versions remain retrievable, and any
  prior version can be restored without losing the versions created after it.
- **SC-003**: Zero commits are ever created for a demand while a required test for its project
  is failing.
- **SC-004**: For any demand that has reached the Pull Request stage, its full traceability
  chain — from client down to Pull Request — can be retrieved as a single, unbroken sequence.
- **SC-005**: Replacing the demand source, code repository host, or LLM used by a project
  requires only configuration changes, with no changes to how demands, specifications, or
  artifacts are processed.
- **SC-006**: A large majority (at least 9 out of 10, sampled) of automatically created Pull
  Requests require no manual edits to their summary, artifact list, changed files, test
  results, or risk notes before a human review begins.
- **SC-007**: A stakeholder can determine a demand's current stage, responsible agent, and
  most recent activity from its cockpit alone, without consulting the underlying demand
  source, code host, or LLM provider directly.
- **SC-008**: The demand cockpit reflects a stage's result within 5 seconds of that stage
  finishing.
- **SC-009**: The platform is available during business hours; scheduled maintenance is
  confined to outside business hours and does not count against availability.
- **SC-010**: The platform supports at least 10 demands concurrently active across
  development, testing, and agent-execution stages without degradation.

## Assumptions

- This specification covers both delivery phases described in the source document: the
  specification-and-tracking foundation (User Stories 1–5, no code changes) and the
  automated-implementation flow (User Stories 6–9, code changes through Pull Request). The
  first phase delivers value on its own; the second builds directly on it.
- Explicitly out of scope for this specification (per the source document): a full QA agent,
  automated homologation/staging approval, automated production deployment, automated change
  management (GMUD), operating a Kubernetes cluster, running multiple agents concurrently on
  the same demand, an agent marketplace, and advanced retrieval-augmented generation. The
  underlying design should not preclude adding these later.
- Client and project management (creation, configuration) are supporting capabilities that
  exist prior to demand intake; they are referenced by the user stories above but are not
  themselves separate user stories in this specification.
- Initial provider implementations are assumed to be: one demand source, one code-repository
  host, two LLMs, and one SDD tool, all reached only through their respective replaceable
  abstractions; additional providers of each kind are expected later but are not required by
  this specification.
- Role-based access control is required (FR-026), but the specific set of roles and their
  exact permissions is a design decision deferred to the implementation plan rather than
  fixed by this specification.
- Standard non-functional expectations apply unless stated otherwise: user-friendly error
  messages with safe fallbacks, and no deletion of records at the storage level (all deletion
  is soft/logical).
