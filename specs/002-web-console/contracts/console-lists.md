# Contract: Cross-Demand List Endpoints

All endpoints below return the shared pagination envelope (`data-model.md`) and require
authentication. Implements spec FR-013, FR-015, FR-021 (execution list), FR-024, FR-026,
FR-028.

## Workspaces (FR-013)

### `GET /api/v1/workspaces`

- **Query params**: `demand_id?`, `page?`, `page_size?`.
- **200**: paginated `DemandWorkspace[]`.
- Complements 001's existing `GET /workspaces/:id` (single item) and
  `GET /workspaces/:id/tree`/`/files`, which are unchanged and reused by the Workspaces
  screen's detail view (spec User Story 6).

## Artifacts (FR-015)

### `GET /api/v1/artifacts`

- **Query params**: `demand_id?`, `type?`, `status?`, `page?`, `page_size?`.
- **200**: paginated `Artifact[]`.
- Complements 001's existing `GET /demands/:id/artifacts` (still used by the per-demand
  cockpit) and `GET /artifacts/:id`/`/files`/`/versions` (unchanged, reused by this screen's
  detail view — spec User Story 7 / FR-016).

## Executions (FR-021 pagination)

### `GET /api/v1/executions` (extended)

- **New query params**: `page?`, `page_size?`, added alongside the existing `demand_id?`,
  `agent_id?`, `status?` filters from 001.
- **200**: now returns the paginated envelope instead of a bare array (breaking change
  scoped to this feature, acceptable since 001's only consumer — none yet in a shipped UI —
  is being introduced by this same feature).

## Repositories (FR-024/FR-025)

### `GET /api/v1/repositories`

- **Query params**: `project_id?`, `page?`, `page_size?`.
- **200**: paginated `Repository[]`.

### `GET /api/v1/repositories/:id`

- **200**: `Repository`.

### `GET /api/v1/repositories/:id/artifacts`

- **200**: `Artifact[]` — the artifacts referencing this repository (spec 001 FR-016's N:N
  relationship, made visible per spec 002 FR-025). Not paginated (bounded by how many
  artifacts realistically reference one repository).

## Git activity (FR-026/FR-027)

### `GET /api/v1/branches`

- **Query params**: `repository_id?`, `demand_id?`, `page?`, `page_size?`.
- **200**: paginated `Branch[]`, each including its `demandId` for the "link back to demand"
  requirement (FR-026).

### `GET /api/v1/commits`

- **Query params**: `repository_id?`, `demand_id?`, `page?`, `page_size?`.
- **200**: paginated `Commit[]`.

### `GET /api/v1/pull-requests`

- **Query params**: `repository_id?`, `demand_id?`, `status?`, `page?`, `page_size?`.
- **200**: paginated `PullRequest[]`.
- Complements 001's existing `GET /pull-requests/:id` (single item, includes live `checks` —
  unchanged, reused by this screen's detail view for FR-027).

## Audit (FR-028 pagination)

### `GET /api/v1/audits` (extended)

- **New query params**: `page?`, `page_size?`, added alongside 001's existing `entity_type?`,
  `entity_id?`, `actor_user_id?`, `from?`, `to?` filters.
- **200**: now returns the paginated envelope instead of a bare array (same scoped-breaking-
  change reasoning as Executions above).
