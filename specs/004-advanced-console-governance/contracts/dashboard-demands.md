# Contract: Dashboard KPIs & Demands list enrichment

Implements spec FR-009 through FR-016 (User Stories 3, 4).

## `GET /api/v1/dashboard/summary` (extended, existing endpoint)

- **200** (extended shape): existing `{stageCounts, recentDemands}` plus:
  ```json
  {
    "totals": {"all": 0, "open": 0, "inSpecification": 0, "inDevelopment": 0, "blocked": 0},
    "pullRequestsOpen": 0,
    "testsFailing": 0,
    "agentsRunning": 0,
    "byClient": [{"clientId": "...", "clientName": "...", "count": 0}],
    "avgTimePerStage": [{"stage": "SPECIFICATION", "avgHours": 0}]
  }
  ```
- Every count is derived per research.md §5/§6 — no client-side aggregation.

## `GET /api/v1/demands` (extended, existing endpoint)

- **Query params** (added): `agent_id?`, `pr_status?`, `created_after?`, `created_before?`
  (ISO dates), alongside existing `client_id`, `project_id`, `status`, `type`, `page`,
  `page_size`.
- **200** (extended item shape): existing `Demand` fields plus `clientName`, `projectName`,
  `currentIncrement: {number, status} | null`, `currentAgent: {name} | null`,
  `latestPullRequest: {externalReference, status} | null`.

## `POST /api/v1/demands/import` (new)

- **Body**: `{ externalId: string, clientId: string, projectId: string }` (origin is always
  `"monday"` for this endpoint per spec — a future provider would get its own route or a
  `provider` field, out of scope here).
- **409**: if `(origin, externalId)` already imported (FR-016, reusing the existing
  `DemandsService.importFromProvider()` guarantee unchanged since 001).
- **201**: the created `Demand`.

## Frontend contract

`Dashboard.tsx` renders new KPI cards (totals/PRs/tests/agents/by-client/avg-time), each
`onClick` navigating to `/demands?<matching filter query params>` (FR-012). `Demands.tsx`
gains the new columns, filter controls, and an "Importar do Monday" action opening a small
form (external ticket ID + client + project pickers) calling the import endpoint above.
