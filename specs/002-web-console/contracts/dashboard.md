# Contract: Dashboard

Implements spec FR-006, FR-007.

## `GET /api/v1/dashboard/summary`

- **Query params**: `recent_limit?` (default 10).
- **200**: `DashboardSummary` (see `data-model.md`):
  ```json
  {
    "stageCounts": [{ "stage": "SPECIFICATION", "count": 4 }, { "stage": "DEVELOPMENT", "count": 2 }],
    "recentDemands": [ /* Demand[], most recently updated first */ ]
  }
  ```
- Requires authentication (spec FR-001); no role restriction beyond "any signed-in user" —
  the dashboard is the landing page for every role.
