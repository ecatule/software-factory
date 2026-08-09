# Contract: Clients, Projects, Providers, Repositories, Audit

## Clients

- `GET /api/v1/clients`, `POST /api/v1/clients`, `GET /api/v1/clients/:id`,
  `PATCH /api/v1/clients/:id`.

## Projects

- `GET /api/v1/projects`, `POST /api/v1/projects`, `GET /api/v1/projects/:id`,
  `PATCH /api/v1/projects/:id` — `PATCH` includes `required_test_suites` and
  `branch_naming_policy`.

## Providers

- `GET /api/v1/providers` — lists registered `Provider` rows (the fixed catalog: demand
  source, code repository, LLM, SDD, storage kinds).
- `GET /api/v1/providers/:id/configurations` / `POST /api/v1/providers/:id/configurations` —
  manage `ProviderConfiguration` rows (project-scoped or platform-default). `settings` in the
  request body MUST NOT contain secret values (constitution: no credential in code or data —
  secrets are referenced by name and resolved from the environment/secret store at runtime).

## Repositories

- `GET /api/v1/repositories`, `POST /api/v1/repositories`, `GET /api/v1/repositories/:id`.
- `GET /api/v1/repositories/:id/artifacts` — reverse lookup, since a repository can back
  multiple artifacts (spec FR-016).

## Audit

- `GET /api/v1/audits`
  - **Query params**: `entity_type?`, `entity_id?`, `actor_user_id?`, `from?`, `to?`.
  - **200**: `AuditLog[]` — the same underlying data the demand timeline endpoint filters
    down to one demand (spec FR-025, FR-024 traceability).

## Cross-cutting: traceability

### `GET /api/v1/demands/:id/trace`

- **200**: the full chain described in spec FR-024 — client, project, requirement,
  specification (+ version), workspace, artifacts (+ repositories), branch, files, tasks,
  responsible agent/LLM, commits, tests, pull request, and the actor + timestamp of each step.
  Implemented as a read-model that joins the resources above rather than a new stored entity.
