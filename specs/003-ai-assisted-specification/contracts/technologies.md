# Contract: Technology catalog & Project association

Implements spec FR-014, FR-015, FR-016 (User Story 2). All endpoints behind the existing
global `JwtAuthGuard` — no additional role required (consistent with 001/002 baseline).

## `GET /api/v1/technologies`

- **Query params**: `page?`, `page_size?` (capped at 100, per the shared `paginate()` helper).
- **200**: paginated `Technology[]` — `{id, name, category, version, description, status, ...}`.

## `POST /api/v1/technologies`

- **Body**: `{ name, category, version?, description?, status? }`.
- **201**: the created `Technology`.

## `PATCH /api/v1/technologies/:id`

- **Body**: partial `{ name?, category?, version?, description?, status? }`.
- **200**: the updated `Technology`.

## `GET /api/v1/projects/:id/technologies`

- **200**: `Technology[]` currently associated with the project.

## `PUT /api/v1/projects/:id/technologies`

- **Body**: `{ technologyIds: string[] }` — replaces the full association set for the project
  (simplest correct semantics for a multi-select field on the Projects screen; idempotent).
- **200**: `Technology[]` reflecting the new association set.

## Frontend contract

`Technologies.tsx` — a `DataTable` + `Modal`/`FormField` create/edit screen, same pattern as
`Clients.tsx`. `Projects.tsx`'s edit form gains a multi-select technology field backed by
`GET /technologies` (options) and `GET/PUT /projects/:id/technologies` (current value/save).
