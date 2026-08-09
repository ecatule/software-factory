# Contract: Agent Executions, Tests, and Git Activity (P2 slice)

## Agent Executions

### `GET /api/v1/executions` / `GET /api/v1/executions/:id`

- **Query params** (list): `demand_id?`, `agent_id?`, `status?`.
- **200**: `AgentExecution` / `AgentExecution[]`.

### `POST /api/v1/executions`

- **Body**: `{ agent_id, demand_id, provider_configuration_id? }` — enqueues a BullMQ job;
  the endpoint returns immediately with `status: "QUEUED"` (spec User Stories 2 and 6 are both
  driven through this same execution mechanism — the Specification Agent and the Developer
  Agent are both `Agent` rows).
- **202**: `AgentExecution` with `status: "QUEUED"`.

### `POST /api/v1/executions/:id/retry`

- **200**: a new `AgentExecution` linked to the same demand — used when a provider was
  unavailable (spec Edge Cases: LLM/repository provider unavailable mid-execution).

### `POST /api/v1/executions/:id/cancel`

- **200**: `AgentExecution` with `status: "CANCELLED"`.

## Tests / Test Gate

### `GET /api/v1/demands/:id/tests`

- **200**: `TestExecution[]` (each with its `TestResult`) for this demand.

### `POST /api/v1/demands/:id/tests/run`

- Triggers the project's required suites via the Test Runner.
- **202**: `TestExecution[]` with `status: "RUNNING"`.

### Test Gate enforcement

`POST /api/v1/demands/:id/commit` (below) MUST return **422** with the failing suite names if
any required `TestExecution` for the current attempt has `status: "FAILED"` — no `Commit` row
is created in that case (spec FR-021).

## Git activity

### `POST /api/v1/demands/:id/branch`

- Creates (or reuses, per repository) the demand's branch following the project's
  `branch_naming_policy` (spec FR-019).
- **201**: `Branch`.

### `POST /api/v1/demands/:id/commit`

- **Preconditions**: Test Gate passed (see above).
- **201**: `Commit`, linked to `demand_id`, `artifact_id`, the authorizing
  `test_execution_id`, and `agent_execution_id` (spec FR-022).

### `POST /api/v1/demands/:id/pull-request`

- **Body**: none required — content is derived server-side from the demand, its artifacts,
  changed files, test results, and any recorded risks (spec FR-023).
- **201**: `PullRequest`.

### `GET /api/v1/demands/:id/git`

- **200**: `{ repositories: Repository[], branches: Branch[], commits: Commit[],
  pull_requests: PullRequest[] }` — powers the Git tracking view (spec User Story 9).

## Pull Requests (direct resource access)

### `GET /api/v1/pull-requests/:id`

- **200**: `PullRequest` with its `checks` (fetched live from the `CodeRepositoryProvider`,
  not persisted separately).
