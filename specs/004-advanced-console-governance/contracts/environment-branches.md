# Contract: Project/Repository environment & branch fields

Implements spec FR-001, FR-002, FR-003 (User Story 1).

## `PATCH /api/v1/projects/:id` (extended, existing endpoint)

- **Body** (extended): existing fields plus `{ productionBranch?, homologationBranch?,
  homologationEnvironment?, productionEnvironment? }`.
- **200**: the updated `Project`, now including these fields.

## `GET /api/v1/projects/:id` / `GET /api/v1/projects` (extended, existing endpoints)

- Response now includes the four new fields (additive, no breaking change).

## `PATCH /api/v1/repositories/:id` (new — Repository had no update endpoint before)

- **Body**: `{ productionBranch?, homologationBranch? }`.
- **200**: the updated `Repository`.

## `GET /api/v1/repositories`, `GET /api/v1/repositories/:id` (extended, existing endpoints)

- Response now includes `productionBranch`/`homologationBranch`.

## Frontend contract

`Projects.tsx`'s edit form gains four fields. `Repositories.tsx` gains an edit action (it was
previously read-only — a `Modal`+`FormField` pair, same pattern as `Clients.tsx`) for its two
new fields. `SpecificationWorkspace.tsx`'s technical-input template (from the earlier
follow-up in this session) replaces its "informar manualmente" placeholder for "Branch de
Origem" with the resolved value: the branch of the repository backing the demand's known
artifacts if one exists, else the project's own branch fields.
