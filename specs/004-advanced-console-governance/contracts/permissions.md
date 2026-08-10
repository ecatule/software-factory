# Contract: Granular RBAC permissions

Implements spec FR-004 through FR-008, FR-007a (User Story 2).

## `GET /api/v1/roles/:id/permissions` (new)

- **200**: `Permission[]` currently associated with the role.

## `PUT /api/v1/roles/:id/permissions` (new)

- **Body**: `{ permissionNames: string[] }` — replaces the role's full permission set
  (same idempotent replace-set semantics as feature 003's
  `PUT /projects/:id/technologies`, including the same soft-remove-via-flag concern if a
  join-row-level flag turns out to be needed — decided at task-writing time by checking
  whether `RolePermission` needs the same `stAtivo` treatment `ProjectTechnology` needed).
- **200**: `Permission[]` reflecting the new set.

## `GET /api/v1/permissions` (new)

- **200**: the full fixed catalog (`Permission[]`, all 8 FR-004 rows) — for populating the
  role-permission-assignment UI.

## Every endpoint listed in research.md §4's table (extended, existing endpoints)

Each gains a `@RequirePermission("<PERMISSION_NAME>")` decorator per that table. On a
missing permission: **403** with a body identifying the specific missing permission (FR-007),
e.g. `{"message": "Requires permission SPECIFICATION_APPROVE", "error": "Forbidden",
"statusCode": 403}` — mirrors the existing `RbacGuard` role-rejection message shape.

## `GET /api/v1/auth/session` (extended, existing endpoint)

- Response `user` object gains `permissions: string[]` alongside the existing `roles`.

## Frontend contract

`AuthContext.tsx` exposes `hasPermission(name: string): boolean`. Every UI action gated by a
permission in research.md §4's table is wrapped so it's hidden/disabled when
`!hasPermission(...)`, per Clarifications 2026-08-09 (FR-007a) — e.g.
`SpecificationWorkspace.tsx`'s "Aprovar" button requires `SPECIFICATION_APPROVE`. A new
`Settings`-adjacent screen (or a section within it, decided at task-writing time) lets an
admin view/edit a role's permissions via the endpoints above.
