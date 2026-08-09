# Feature Specification: Web Console — Administrative Screens

**Feature Branch**: `002-web-console`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "Console administrativo web para a AI Software Factory, construído
sobre o backend da feature 001. Cobrir as telas que faltam: Dashboard, Login, Clients,
Projects, Demands (lista+criação), Workspaces, Artifacts, Specifications (editor com
histórico/diff/restore), Agents, Executions, Tests, Repositories, Branches/Commits/
PullRequests, Audit, Settings (configuração de Providers). A maioria já tem backend REST
completo; login, listagem de Providers, e listagem de Repositories/Workspaces são lacunas de
backend que entram no escopo desta feature."

## User Scenarios & Testing *(mandatory)*

<!--
  This feature is the administrative web console for the platform built in 001
  (`001-ai-software-factory`), which shipped only a single screen (the per-demand cockpit).
  Every other screen an operator needs to run the platform without calling the API directly
  is in scope here. Priorities follow what's needed to operate the platform at all (P1) down
  to administrative/observability conveniences (P5) — each tier is a deployable increment on
  top of the previous one, matching how 001 was delivered.
-->

### User Story 1 - Sign in to the console (Priority: P1)

A user opens the web console and signs in with their organizational identity, so that
everything they do afterward is attributed to them and gated by their role.

**Why this priority**: Nothing else in the console can be used without this — it's the entry
point for every other story.

**Independent Test**: Open the console while signed out, sign in with valid credentials, and
confirm access to the rest of the console; confirm invalid credentials are rejected with a
clear message and no access is granted.

**Acceptance Scenarios**:

1. **Given** a signed-out user, **When** they open any console URL, **Then** they are sent to
   sign-in before seeing any platform data.
2. **Given** valid credentials, **When** the user signs in, **Then** they land in the console
   with their session active and their identity visible somewhere in the interface.
3. **Given** an expired session, **When** the user takes an action, **Then** they are returned
   to sign-in rather than seeing a broken or partially-loaded screen.

---

### User Story 2 - Dashboard overview (Priority: P1)

A signed-in user opens the console and immediately sees a high-level picture of what's
happening across the platform, so they know where to look next without hunting through
individual screens.

**Why this priority**: This is the console's home screen and the first thing every user sees
after signing in.

**Independent Test**: Open the dashboard with several demands in different stages and confirm
counts/summaries reflect actual platform state, with links into the relevant detail screens.

**Acceptance Scenarios**:

1. **Given** demands exist in various stages, **When** the dashboard loads, **Then** it shows
   how many demands are in each broad state (e.g. in specification, in development, done).
2. **Given** recent activity exists, **When** the dashboard loads, **Then** the most recently
   updated demands are listed with a link to each one's cockpit.

---

### User Story 3 - Manage Clients (Priority: P1)

An administrator views the list of clients, creates a new client, and edits an existing one,
so that demands can be associated with the correct client from the start.

**Why this priority**: A client must exist before a project or demand can be created — this is
a hard prerequisite for the rest of the console to be useful.

**Independent Test**: Create a client, confirm it appears in the list, edit its name, and
confirm the change is reflected immediately.

**Acceptance Scenarios**:

1. **Given** the Clients screen, **When** a user creates a client with a name, **Then** it
   appears in the client list.
2. **Given** an existing client, **When** a user edits and saves it, **Then** the updated
   values are shown without needing a page reload.

---

### User Story 4 - Manage Projects (Priority: P1)

An administrator views projects for a client, creates a new project (with its required test
suites and branch naming policy), and edits an existing one.

**Why this priority**: Like clients, a project must exist before a demand can reference it.

**Independent Test**: Create a project under an existing client, confirm it appears filtered
by that client, and confirm its required test suites are saved and displayed.

**Acceptance Scenarios**:

1. **Given** an existing client, **When** a user creates a project under it, **Then** the
   project appears associated with that client.
2. **Given** an existing project, **When** a user edits its required test suites, **Then** the
   updated list is saved and shown.

---

### User Story 5 - List and create Demands (Priority: P1)

A user browses all demands with filters (client, project, status, type), and creates a new
demand by hand when one doesn't already exist from the external demand source.

**Why this priority**: Demands are the platform's central entity; without a way to see and
create them outside the API, the console isn't usable for day-to-day work.

**Independent Test**: Open the demand list, filter by status, create a new demand, and confirm
it appears in the list and its cockpit opens correctly.

**Acceptance Scenarios**:

1. **Given** demands in different states, **When** a user filters by status, **Then** only
   matching demands are shown.
2. **Given** the demand creation form, **When** a user submits valid data, **Then** the demand
   is created and the user is taken to its cockpit.
3. **Given** a demand with the same origin/external id as an existing one, **When** a user
   tries to create it, **Then** the console shows the rejection reason clearly (spec 001
   FR-028), not a generic error.

---

### User Story 6 - Browse Workspaces (Priority: P2)

A user browses demand workspaces across the platform (not just one at a time from within a
single demand's cockpit), to find and inspect a workspace without first locating its demand.

**Why this priority**: Useful once there are enough demands that navigating workspace-by-
workspace from a single demand's cockpit isn't enough.

**Independent Test**: Open the Workspaces screen, confirm workspaces from multiple demands are
listed, and confirm opening one shows the same `spec/`+`artefatos/` tree as the demand cockpit.

**Acceptance Scenarios**:

1. **Given** multiple demands with workspaces, **When** the Workspaces screen loads, **Then**
   each workspace is listed with its demand and path.
2. **Given** a workspace in the list, **When** a user opens it, **Then** its file tree is shown.

---

### User Story 7 - Browse Artifacts (Priority: P2)

A user browses artifacts across demands, to see which artifacts exist, their type/technology,
and which repository backs each one, without navigating demand-by-demand.

**Why this priority**: Same rationale as Workspaces — becomes necessary at scale.

**Independent Test**: Open the Artifacts screen and confirm artifacts from multiple demands
are listed with type, technology, and status.

**Acceptance Scenarios**:

1. **Given** artifacts exist across several demands, **When** the Artifacts screen loads,
   **Then** each is shown with its demand, type, technology, and status.
2. **Given** an artifact in the list, **When** a user opens it, **Then** its file list
   (including any `DISCOVERED` files with their justification) is shown.

---

### User Story 8 - Edit and version Specifications (Priority: P2)

A user opens a specification document in a Markdown editor, edits and saves it (creating a new
version), views its version history, compares two versions, and restores an older one.

**Why this priority**: This is the richest editing surface in the console and the direct UI
counterpart of spec 001's versioning guarantees (FR-010/FR-011) — valuable once the more basic
navigation screens (P1) exist.

**Independent Test**: Open a specification, edit its content, save it, confirm a new version
appears in history with the prior version intact, then restore the prior version and confirm
it becomes current without losing the version created in between.

**Acceptance Scenarios**:

1. **Given** a specification document, **When** a user edits and saves it, **Then** a new
   version appears in the history list and the previous version remains viewable.
2. **Given** two versions of a specification, **When** a user requests a comparison, **Then**
   the differences are shown clearly (additions/removals distinguishable).
3. **Given** an older version, **When** a user restores it, **Then** it becomes the current
   version and the version history still shows every version, including the one just replaced.

---

### User Story 9 - Manage Agents and trigger Executions (Priority: P3)

A user views the catalog of agents (Specification Agent, Developer Agent), and manually
triggers, retries, or cancels an execution for a given demand, watching its status update.

**Why this priority**: Useful for operating and debugging the automated pipeline, but not
required just to track demands (covered by P1/P2).

**Independent Test**: Trigger an execution for a demand, confirm it appears with status QUEUED
then RUNNING then a terminal status, and confirm retry/cancel controls work as expected.

**Acceptance Scenarios**:

1. **Given** the Agents screen, **When** a user views it, **Then** the registered agents and
   their types are listed.
2. **Given** a demand, **When** a user triggers an execution for a given agent/stage, **Then**
   it appears in the Executions screen with live status updates.
3. **Given** a failed execution, **When** a user retries it, **Then** a new execution is
   created and linked back to the same demand.

---

### User Story 10 - Monitor Executions (Priority: P3)

A user views all agent executions across the platform, filterable by demand/agent/status, to
understand what's running, what failed, and why.

**Why this priority**: Companion to User Story 9 — the observability half of running agents.

**Independent Test**: Filter the Executions screen by status=FAILED and confirm only failed
executions are shown, each with its error message visible.

**Acceptance Scenarios**:

1. **Given** executions in different statuses, **When** a user filters by status, **Then**
   only matching executions are shown.
2. **Given** a failed execution, **When** a user opens its detail, **Then** the error message
   and the input/output captured for that execution are shown.

---

### User Story 11 - View Test results (Priority: P3)

A user views test execution results for a demand, including which required suites passed or
failed, so they understand why the Test Gate did or didn't allow a commit.

**Why this priority**: Directly explains Test Gate outcomes (spec 001 FR-021), valuable once
executions are already observable (P3 tier).

**Independent Test**: Trigger a test run for a demand with a failing suite, and confirm the
Tests screen shows the failing suite distinctly from passing ones, with pass/fail/skip counts.

**Acceptance Scenarios**:

1. **Given** a demand with test executions, **When** the Tests screen loads for it, **Then**
   each suite's status, duration, and pass/fail/skip counts are shown.
2. **Given** a failing suite, **When** a user opens its detail, **Then** the captured output is
   available for inspection.

---

### User Story 12 - Browse Repositories (Priority: P4)

A user views all code repositories registered on the platform, which project each belongs to,
and which artifacts reference each one.

**Why this priority**: Git-related screens matter once demands are reaching the implementation
stage (P2/MVP2 territory in spec 001), later than the specification-focused P1-P3 tiers.

**Independent Test**: Open the Repositories screen and confirm each repository shows its
project and the artifacts that reference it.

**Acceptance Scenarios**:

1. **Given** repositories registered across projects, **When** the screen loads, **Then** each
   is shown with its project and reference (e.g. `org/repo`).
2. **Given** a repository, **When** a user opens it, **Then** the artifacts linked to it are
   listed (spec 001 FR-016's N:N relationship made visible).

---

### User Story 13 - View Git activity (branches, commits, Pull Requests) (Priority: P4)

A user views branches, commits, and Pull Requests across demands (not only from within one
demand's cockpit), to track implementation progress at a glance.

**Why this priority**: Companion to Repositories — completes the Git-related tier.

**Independent Test**: Open the Git activity screen and confirm branches/commits/PRs from
multiple demands are listed with links back to their demand.

**Acceptance Scenarios**:

1. **Given** demands with Git activity, **When** the screen loads, **Then** branches, commits,
   and Pull Requests are listed with their demand and status.
2. **Given** a Pull Request in the list, **When** a user opens it, **Then** its checks (from
   the code host) are shown.

---

### User Story 14 - Browse the Audit log (Priority: P5)

A user searches the platform's audit log by entity type, entity, actor, or date range, to
answer "who did what, when" for any critical operation.

**Why this priority**: Compliance/oversight capability, needed less frequently than the
day-to-day screens in earlier tiers.

**Independent Test**: Perform a few actions (create a client, create a demand), then search the
audit log filtered by entity type and confirm the corresponding entries appear with actor and
timestamp.

**Acceptance Scenarios**:

1. **Given** recorded audit entries, **When** a user filters by entity type and a date range,
   **Then** only matching entries are shown.
2. **Given** an audit entry, **When** a user views it, **Then** the actor, action, and
   before/after state are visible.

---

### User Story 15 - Configure Providers (Settings) (Priority: P5)

An administrator views the platform's provider catalog (demand source, code repository, LLM,
SDD, storage) and configures non-secret settings per project or platform-wide, including which
LLM is used at which pipeline stage.

**Why this priority**: Administrative configuration, needed rarely compared to daily operation
— appropriate for the last tier.

**Independent Test**: Open Settings, configure a project-specific LLM provider for the "plan"
pipeline stage, and confirm a subsequent execution for that stage and project uses it.

**Acceptance Scenarios**:

1. **Given** the Provider catalog, **When** the Settings screen loads, **Then** every
   registered provider (demand source, code repository, LLM, SDD, storage) is listed with its
   kind.
2. **Given** a provider, **When** an administrator adds a project-scoped configuration for a
   specific pipeline stage, **Then** it is saved and shown associated with that project/stage.
3. **Given** a configuration form, **When** an administrator enters a value that looks like a
   secret (e.g. an API key), **Then** the console blocks the submission and explains that
   secrets are configured via environment/secret store, not through this screen (constitution:
   no credential in code or data).

---

### Edge Cases

- What happens when a user's session expires while they're mid-edit on a Specification? The
  edit must not be silently lost — the console must warn before navigating away with unsaved
  changes, and re-authentication must not discard the draft in progress.
- What happens when two administrators edit the same Client/Project at the same time? The
  second save must be rejected or reconciled based on the record's version (optimistic
  locking), never silently overwritten (consistent with spec 001's `version` column).
- What happens when a user without the required role opens a restricted screen (e.g. Settings)?
  The console must not render restricted data even briefly — access must be denied before any
  protected data is fetched or shown.
- What happens when the list of demands, executions, or audit entries is very large? Every list
  screen must paginate rather than attempt to load everything at once.
- What happens when a Login attempt fails (wrong credentials, identity provider unavailable)?
  The user must see a clear, actionable message and must not be left on a blank or frozen
  screen.

## Requirements *(mandatory)*

### Functional Requirements

**Navigation & Access**

- **FR-001**: The console MUST require an authenticated session before displaying any
  platform data, redirecting signed-out users to sign-in.
- **FR-002**: The console MUST provide a persistent navigation shell giving access to every
  screen the signed-in user's role permits (Dashboard, Clients, Projects, Demands, Workspaces,
  Artifacts, Specifications, Agents, Executions, Tests, Repositories, Git activity, Audit,
  Settings).
- **FR-003**: The console MUST hide or disable navigation to screens the current user's role
  does not permit, and MUST NOT fetch that screen's data if navigated to directly.
- **FR-004**: The system MUST provide a real sign-in flow: exchanging user-supplied
  credentials (via the platform's configured OIDC identity provider) for the platform's
  access/refresh tokens — closing the gap where only token refresh existed previously.
- **FR-005**: The console MUST detect an expired or invalid session during use and return the
  user to sign-in rather than showing a broken screen.

**Dashboard**

- **FR-006**: The system MUST provide a dashboard view summarizing demand counts grouped by
  workflow stage.
- **FR-007**: The dashboard MUST list the most recently updated demands, each linking to its
  cockpit.

**Clients & Projects**

- **FR-008**: The console MUST allow listing, creating, and editing Clients.
- **FR-009**: The console MUST allow listing (filterable by client), creating, and editing
  Projects, including their required test suites and branch naming policy.

**Demands**

- **FR-010**: The console MUST allow listing Demands with filters for client, project, status,
  and type, with pagination.
- **FR-011**: The console MUST allow creating a Demand by hand, using the same validation rules
  as the API (including the FR-028 re-import rejection from spec 001, surfaced as a clear
  message rather than a raw error).
- **FR-012**: Each Demand in the list MUST link to its existing cockpit view (spec 001 User
  Story 5) rather than duplicating cockpit functionality here.

**Workspaces & Artifacts**

- **FR-013**: The system MUST provide a way to list all demand workspaces across the platform
  (not solely by looking up one demand at a time) — a new capability, since only per-demand
  workspace lookup exists today.
- **FR-014**: The console MUST allow opening any workspace from that list to view its file
  tree, reusing the existing per-workspace tree/file endpoints.
- **FR-015**: The console MUST allow listing Artifacts across demands, each showing its demand,
  type, technology, and status, with pagination.
- **FR-016**: The console MUST allow viewing an artifact's file list, including files marked
  `DISCOVERED` together with their required justification (spec 001 FR-017).

**Specifications**

- **FR-017**: The console MUST provide a Markdown editor for specification documents that saves
  edits as new versions, never overwriting a prior version (spec 001 FR-010).
- **FR-018**: The console MUST show a specification's version history and allow comparing any
  two versions.
- **FR-019**: The console MUST allow restoring a prior version, which creates a new version
  rather than deleting anything (spec 001 FR-011).

**Agents & Executions**

- **FR-020**: The console MUST list registered Agents and their type.
- **FR-021**: The console MUST allow triggering a new execution for a demand/agent/pipeline
  stage, and allow retrying or cancelling an existing execution.
- **FR-022**: The console MUST list Agent Executions with filters for demand, agent, and
  status, each showing enough detail (timestamps, error message when failed) to diagnose an
  outcome without leaving the console.

**Tests**

- **FR-023**: The console MUST show test execution results for a demand, including suite name,
  status, duration, and pass/fail/skip counts, and MUST allow triggering a new test run.

**Repositories & Git activity**

- **FR-024**: The system MUST provide a way to list all Repositories across projects (not
  solely by looking one up by id) — a new capability, since no such listing exists today.
- **FR-025**: The console MUST show, for a repository, the artifacts that reference it (spec
  001 FR-016's N:N relationship).
- **FR-026**: The console MUST provide a cross-demand view of branches, commits, and Pull
  Requests, each linking back to its demand, reusing the existing per-demand Git endpoints.
- **FR-027**: The console MUST show a Pull Request's checks (fetched live from the code host,
  as spec 001 already supports).

**Audit**

- **FR-028**: The console MUST allow searching the audit log by entity type, entity id, actor,
  and date range, showing actor, action, and before/after state per entry.

**Settings (Providers)**

- **FR-029**: The system MUST provide a way to list the Provider catalog and its
  per-project/per-pipeline-stage `ProviderConfiguration` rows — a new capability, since no
  such endpoint exists today even though the underlying data already does.
- **FR-030**: The console MUST allow an administrator to create or update a
  `ProviderConfiguration`'s non-secret `settings`, scoped to a project and, for LLM providers,
  a pipeline stage.
- **FR-031**: The console MUST reject any configuration value that appears to be a secret
  (e.g. an API key pattern) with an explanation that secrets belong in environment/secret
  store configuration, never in this screen or the database (constitution: no credential in
  code or data).

**Cross-cutting**

- **FR-032**: Every list screen introduced by this feature (Demands, Workspaces, Artifacts,
  Executions, Repositories, Git activity, Audit) MUST paginate rather than load its entire
  result set at once.
- **FR-033**: Every create/edit form MUST surface the API's validation errors (including
  optimistic-locking `version` conflicts) in a way a non-technical user can act on, not as a
  raw error code.

### Key Entities

This feature is a UI layer over entities already defined in `001-ai-software-factory`'s
`data-model.md` (Client, Project, Demand, DemandWorkspace, Artifact, ArtifactFile,
Specification, SpecificationVersion, Agent, AgentExecution, TestExecution, TestResult,
Repository, Branch, Commit, PullRequest, AuditLog, Provider, ProviderConfiguration, User,
Role, Permission) — no new persisted entities are introduced. The only new backend surface is
the **endpoints** named in FR-004, FR-013, FR-024, and FR-029 (login, workspace listing,
repository listing, provider/configuration listing+editing), not new data models.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can sign in and reach any screen their role permits within 2 clicks
  from the dashboard.
- **SC-002**: A user can create a Client, a Project under it, and a Demand under that project,
  entirely through the console, in under 3 minutes combined.
- **SC-003**: 100% of the 15 screens in scope are reachable from the navigation shell without
  requiring the browser's address bar or direct API calls.
- **SC-004**: A user investigating a failed execution or failed test suite can find the error
  detail (error message / suite output) within 2 clicks from the Dashboard, without consulting
  the API or logs directly.
- **SC-005**: 100% of specification version restores performed through the console are visible
  in the version history afterward, with zero prior versions lost (verifies FR-019's UI path
  matches spec 001's FR-011 guarantee).
- **SC-006**: An attempt to save a value that looks like a secret into a Provider configuration
  is blocked 100% of the time, with an explanation shown.
- **SC-007**: Every list screen in scope remains responsive (renders and accepts filter input
  without perceptible lag) with at least 500 records in the underlying table.

## Assumptions

- **Login mechanism**: implemented as a redirect-based OIDC Authorization Code flow against
  whichever identity provider is configured for the deployment (per `001`'s research.md §7,
  which deliberately left the specific IdP open) — the backend exchanges the resulting code for
  the platform's own access/refresh tokens. A username/password form directly against the
  platform's own store is explicitly out of scope; the platform is not the identity source of
  truth.
- **Provider secrets**: remain configured exclusively via environment/secret store, per the
  constitution and spec 001's Assumptions — this feature only adds visibility and non-secret
  configuration (FR-029/030), never secret storage or entry.
- **RBAC granularity**: as in spec 001, a full permission matrix is not defined here; screens
  are gated by role at a coarse level (e.g. "admin" for Settings) consistent with spec 001's
  deferred RBAC detail. A finer-grained matrix remains a follow-up.
- **Scope boundary**: all 15 screens are in scope for this feature (per explicit user
  decision), organized into 5 priority tiers (P1-P5) so that each tier is independently
  deployable, mirroring how `001-ai-software-factory` structured its own P1/P2 split.
- **No new persisted entities**: this feature only adds UI plus the 3 named backend endpoint
  gaps (login, workspace listing, repository listing, provider/configuration
  listing+editing) — it does not change `001`'s data model.
