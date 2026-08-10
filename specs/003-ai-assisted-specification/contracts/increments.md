# Contract: Increment

Implements spec FR-017, FR-018, FR-019, FR-021 (User Story 3). Behind the existing global
`JwtAuthGuard`.

## `GET /api/v1/demands/:demandId/increments`

- **200**: `Increment[]` for the demand, ordered by `number` ascending — each incremen's own
  specification history stays reachable via its `SpecificationVersion.incrementId` (spec
  SC-007).

## `POST /api/v1/demands/:demandId/increments`

- **Body**: `{ title?, reason }` — `reason` required (FR-017).
- **Validation (FR-018)**: rejected with **409** if the demand's `currentIncrementId` points
  to an increment whose specification isn't yet `APPROVED` (edge case: "não há uma base
  aprovada da qual partir").
- **202**: the created `Increment` (status `OPEN`) — note **202 not 201**: creating an
  increment also enqueues the first AI round for it (reusing `POST /executions` internally,
  research.md §1/§3) using the previous increment's approved specification+plan as the
  `SpecificationContext` base (FR-019), so the response is "accepted, processing", matching
  the async pattern established for the copilot round itself. The body still includes the
  created `Increment`; the client polls `GET /executions/:id` (see
  `specification-copilot.md`) for the round's result, exactly as User Story 1 already does.
- Also updates `Demand.currentIncrementId` to the new increment.

## Frontend contract

A "Criar incremento" button on `DemandCockpit.tsx`, gated on the current increment having an
`APPROVED` specification (mirrors the FR-018 server-side check so the button is disabled with
an explanatory tooltip rather than surfacing a raw 409). Submitting opens the same
`SpecificationWorkspace` used by User Story 1, now scoped to the new increment and pre-seeded
with the impact-summary view once the round completes (`changeSummary` on the resulting
`SpecificationVersion`, FR-020).
