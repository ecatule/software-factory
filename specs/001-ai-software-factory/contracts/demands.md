# Contract: Demands

Base path: `/api/v1/demands`. All endpoints require an authenticated user (JWT) and are
subject to RBAC (spec FR-026) and audit logging on write operations (spec FR-025).

## `GET /api/v1/demands`

- **Query params**: `client_id?`, `project_id?`, `status?`, `type?`, `page?`, `page_size?`.
- **200**: `{ items: Demand[], total: number, page: number, page_size: number }`.

## `POST /api/v1/demands`

- **Body**: `{ external_id, origin, title, description, type, priority, client_id,
  project_id }`.
- **201**: `Demand`.
- **409**: `(origin, external_id)` already exists — per spec FR-028, the platform MUST reject
  the request rather than update the existing demand or create a duplicate.

## `GET /api/v1/demands/:id`

- **200**: `Demand` (includes `status`, `responsible_user_id`, timestamps).
- **404**: unknown id.

## `PATCH /api/v1/demands/:id`

- **Body**: partial `Demand` fields the caller is allowed to change directly (e.g.
  `responsible_user_id`, `priority`). Workflow `status` changes go through the workflow
  transition mechanism, not a direct field write — see below.
- **200**: updated `Demand`. **409**: `version` mismatch (optimistic locking).

## `POST /api/v1/demands/:id/transition`

- **Body**: `{ to_stage: string }`.
- **200**: updated `Demand` with new `status`. **422**: transition not allowed by the
  project's `Workflow`/`WorkflowTransition` configuration (spec FR-004/FR-005).

## `GET /api/v1/demands/:id/workspace`

- **200**: `DemandWorkspace` (path, status) — see `contracts/workspaces-and-artifacts.md`.

## `GET /api/v1/demands/:id/workflow`

- **200**: `{ stages: WorkflowStage[], current_stage: string, history: WorkflowTransition[] }`
  — powers the cockpit's workflow-progress view (spec User Story 5).

## `GET /api/v1/demands/:id/timeline`

- **200**: `AuditLog[]` filtered to this demand (and related entities), ordered by
  `occurred_at` ascending — powers the cockpit timeline (spec User Story 5, Acceptance
  Scenario 3).

## `GET /api/v1/demands/:id/artifacts`

- **200**: `Artifact[]` for this demand — see `contracts/workspaces-and-artifacts.md`.

## `GET /api/v1/demands/:id/specifications`

- **200**: `Specification[]` (each with `current_version_id`) for this demand — see
  `contracts/workspaces-and-artifacts.md` for the version sub-resource.

## Polling contract for cockpit freshness (spec SC-008)

`GET /api/v1/demands/:id` and `GET /api/v1/demands/:id/workflow` are designed to be cheap,
cacheable reads safe to poll on a 2-second client interval (per research.md §5 decision) —
no endpoint in this resource performs expensive joins beyond the current demand's own rows.
