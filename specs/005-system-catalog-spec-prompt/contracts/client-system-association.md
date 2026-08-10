# Contract: Client×System association

Implements spec FR-004 through FR-006 (User Story 2).

## `GET /api/v1/clients/:id/systems` (new)

- **200**: `System[]` currently associated (`stAtivo: true` rows in `ClientSystem`) with
  this Client.
- Requires `SYSTEM_READ`.

## `PUT /api/v1/clients/:id/systems` (new)

- **Body**: `{ systemIds: string[] }` — replaces the Client's full associated-System set
  (idempotent, same replace-set semantics as `PUT /roles/:id/permissions` and
  `PUT /projects/:id/technologies`). Soft-remove (`stAtivo: false`) rows no longer in the
  set, upsert (`stAtivo: true`) rows newly present — never `deleteMany` (constitution: no
  physical delete; consistent with `ProjectTechnology`/`RolePermission` fix).
- **422**: if any `systemId` refers to a `System` with `stAtivo: false` (FR-004).
- **200**: `System[]` reflecting the new set.
- Requires `SYSTEM_WRITE` (association editing is treated as a System-management action).

## Audit

Each add/remove writes an `AuditLog` row (`action: "CLIENT_SYSTEM_ASSOCIATED"|
"CLIENT_SYSTEM_DISASSOCIATED"`, `entityType: "client_systems"`) — FR-020.

## Frontend contract

`Clients.tsx`'s edit modal gains a "Sistemas" section (same embedded-list pattern as
`Projects.tsx`'s `ProjectTechnologies`): checkboxes over `GET /systems` (active only),
pre-checked from `GET /clients/:id/systems`, saved via the `PUT` above.
