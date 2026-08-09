# Data Model: AI Software Factory — Core Platform

Every table below additionally carries these **mandatory columns** (constitution Technology &
Data Standards; omitted from each entity's field list to avoid repetition):

```text
id           UUID (primary key)
st_ativo     boolean
created_at   timestamp
updated_at   timestamp
deleted_at   timestamp (nullable — soft delete only, never a physical DELETE)
created_by   UUID (User)
updated_by   UUID (User)
version      integer (optimistic locking)
```

## User / Role / Permission

- **User**: `name`, `email` (unique), `identity_provider_subject` (external OIDC subject id).
- **Role**: `name` (unique), `description`.
- **Permission**: `name` (unique), `description`.
- **Relationships**: `User` N:N `Role` (via `UserRole`); `Role` N:N `Permission` (via
  `RolePermission`). The exact seed set of roles/permissions is deferred (spec Assumptions);
  the schema itself is fixed now so RBAC Guards have a stable shape to check against.

## Client

- **Fields**: `name`, `external_reference` (nullable).
- **Relationships**: 1:N `Project`.

## Project

- **Fields**: `client_id` (FK), `name`, `technologies` (string[]), `branch_naming_policy`
  (string template, default `<type>/<client>/<ticket>-<slug>`), `required_test_suites`
  (string[] — which suites gate the Test Gate for this project).
- **Relationships**: N:1 `Client`; 1:N `Demand`; 1:N `Repository`; 1:N `ProviderConfiguration`.

## Demand

- **Fields**: `external_id`, `origin` (e.g. `monday`), `title`, `description`, `type` (enum:
  `BUG | FEATURE | IMPROVEMENT | TASK | TECHNICAL_DEBT`), `priority`, `client_id` (FK),
  `project_id` (FK), `status` (workflow state, see below), `responsible_user_id` (FK,
  nullable).
- **Relationships**: N:1 `Client`, N:1 `Project`; 1:1 `DemandWorkspace`; 1:N `Specification`;
  1:N `Artifact`; 1:N `AgentExecution`; 1:N `AuditLog` (via entity reference).
- **State machine** (`status`, per spec FR-004): `NEW → SPECIFICATION → CLARIFICATION →
  PLANNING → CHECKLIST → TASKS → ANALYSIS → READY_FOR_DEVELOPMENT → DEVELOPMENT → TESTING →
  COMMIT → PULL_REQUEST`, with exception states `BLOCKED`, `FAILED` (entered from `TESTING` on
  Test Gate failure — spec Edge Cases), and `CANCELLED` reachable from any non-terminal state.
  Transitions are driven by `Workflow`/`WorkflowTransition` (below), not hardcoded, so future
  stages (QA, HOMOLOGATION, APPROVAL, PRODUCTION) can be appended without a schema change.
- **Uniqueness / re-import rule** (spec FR-028, Clarifications 2026-08-07): `(origin,
  external_id)` is unique. On a second import attempt for the same `(origin, external_id)`,
  the platform MUST reject/no-op the sync rather than update the existing row or create a
  duplicate — the existing `Demand` remains authoritative.

## DemandWorkspace

- **Fields**: `demand_id` (FK, unique — 1:1), `path` (e.g. `workspace/<ticket>-<slug>/`),
  `status`.
- **Relationships**: 1:1 `Demand`; the `spec/` and `artefatos/` areas are a filesystem
  convention under `path`, not separate tables.

## Specification / SpecificationVersion

- **Specification**: `demand_id` (FK), `document_type` (enum: `SPEC | PLAN | RESEARCH |
  DATA_MODEL | QUICKSTART | CHECKLIST | TASKS | ANALYSIS`), `current_version_id` (FK →
  `SpecificationVersion`).
- **SpecificationVersion**: `specification_id` (FK), `version_number` (integer, monotonic per
  specification), `content` (text/markdown), `author_user_id` (FK, nullable), `agent_id` (FK,
  nullable), `llm_provider_configuration_id` (FK, nullable), `execution_id` (FK →
  `AgentExecution`, nullable), `reason` (text).
- **Relationships**: N:1 `Demand`; 1:N `SpecificationVersion`; a `SpecificationVersion` is
  never updated or deleted — restoring a prior version creates a **new** version whose content
  copies the restored one, preserving full history (spec FR-010/FR-011).

## Artifact

- **Fields**: `demand_id` (FK), `name`, `type` (e.g. `frontend | backend | database`),
  `description`, `technology`, `path`, `status`.
- **Relationships**: N:1 `Demand`; N:N `Repository` (via `ArtifactRepository` — spec FR-016
  explicitly requires N:N, not 1:1); 1:N `ArtifactFile`.

## ArtifactFile

- **Fields**: `artifact_id` (FK), `file_path`, `change_type` (enum: `MODIFIED | ADDED |
  REMOVED | DISCOVERED`), `reason` (text, required when `change_type = DISCOVERED` — spec
  FR-017), `status`.
- **Relationships**: N:1 `Artifact`.

## Workflow / WorkflowStage / WorkflowTransition

- **Workflow**: `name`, `project_id` (FK, nullable — null means platform default).
- **WorkflowStage**: `workflow_id` (FK), `key` (e.g. `DEVELOPMENT`), `order`.
- **WorkflowTransition**: `workflow_id` (FK), `from_stage_id` (FK), `to_stage_id` (FK),
  `condition` (nullable — e.g. `test_gate_passed`).
- **Rationale**: the `Demand.status` state machine is data-driven through these tables (spec
  FR-005: workflow MUST be extensible without touching in-flight demands), rather than an
  enum hardcoded in application code.

## Agent / AgentExecution

- **Agent**: `name` (e.g. `SpecificationAgent`, `DeveloperAgent`), `type`.
- **AgentExecution**: `agent_id` (FK), `demand_id` (FK), `provider_configuration_id` (FK →
  `ProviderConfiguration`, which LLM was used), `status` (enum: `QUEUED | RUNNING | COMPLETED
  | FAILED | CANCELLED`), `started_at`, `finished_at`, `input` (jsonb), `output` (jsonb),
  `error` (text, nullable).
- **Relationships**: N:1 `Agent`; N:1 `Demand`; referenced by `SpecificationVersion.
  execution_id` and by `Commit`/`ArtifactFile` provenance.

## Provider / ProviderConfiguration

- **Provider**: `key` (e.g. `monday`, `github`, `chatgpt`, `claude`, `speckit`, `minio`),
  `kind` (enum: `DEMAND_SOURCE | CODE_REPOSITORY | LLM | SDD | STORAGE`).
- **ProviderConfiguration**: `provider_id` (FK), `project_id` (FK, nullable — null means
  platform default), `pipeline_stage` (nullable — e.g. which SDD stage this LLM config
  applies to, satisfying spec FR-008's per-stage LLM configurability), `settings` (jsonb —
  non-secret config only; secrets are referenced by name and resolved from environment/secret
  store, never stored in this table, per constitution "no credential in code/data").
- **Relationships**: N:1 `Provider`; referenced by `Demand`'s `DemandProvider`, `Artifact`'s
  `Repository`, and `AgentExecution`'s LLM choice.

## Repository / Branch / Commit / PullRequest

- **Repository**: `project_id` (FK), `provider_configuration_id` (FK), `external_reference`
  (e.g. `org/repo`).
- **Branch**: `repository_id` (FK), `demand_id` (FK), `name` (following the project's
  `branch_naming_policy`). Unique on `(repository_id, demand_id)` — spec Edge Cases: multiple
  artifacts sharing one repository share one branch, never duplicate branches/clones.
- **Commit**: `branch_id` (FK), `sha`, `demand_id` (FK), `artifact_id` (FK), `task_reference`
  (nullable), `test_execution_id` (FK), `agent_execution_id` (FK) — every commit is traceable
  to the demand, artifact, task, and the test run that authorized it (spec FR-022).
- **PullRequest**: `repository_id` (FK), `demand_id` (FK), `external_reference`, `title`,
  `description`, `status`.

## TestExecution / TestResult

- **TestExecution**: `demand_id` (FK), `project_id` (FK), `suite` (which required suite),
  `command`, `status`, `started_at`, `finished_at`, `duration_ms`, `coverage` (nullable),
  `output` (text), `error` (text, nullable).
- **TestResult**: `test_execution_id` (FK), `passed_count`, `failed_count`, `skipped_count`.
- **Test Gate rule** (spec FR-021): a `Commit` MUST NOT be created for a `Demand` while any
  `TestExecution` for a required suite on the current attempt has `status = FAILED`.

## AuditLog

- **Fields**: `actor_user_id` (FK, nullable), `actor_agent_execution_id` (FK, nullable),
  `action`, `entity_type`, `entity_id`, `before` (jsonb, nullable), `after` (jsonb, nullable),
  `correlation_id`, `occurred_at`.
- **Relationships**: polymorphic reference via `(entity_type, entity_id)` to any auditable
  entity (spec FR-025); written by a cross-cutting NestJS interceptor, not by individual
  modules, so no critical operation can skip auditing by omission.

## Follow-ups deferred to seeding/config (not schema changes)

- Concrete `Role`/`Permission` seed rows and the permission matrix (spec Assumptions: RBAC
  detail deferred).
- Retention policy (how long `SpecificationVersion` and `AuditLog` rows are kept) — the schema
  imposes no artificial limit; a retention job, if any, is an operational decision outside
  this data model.
