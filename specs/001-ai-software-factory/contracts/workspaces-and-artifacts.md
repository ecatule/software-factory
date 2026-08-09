# Contract: Workspaces, Artifacts, and Specifications

## Workspace

### `GET /api/v1/workspaces/:id`

- **200**: `DemandWorkspace`.

### `GET /api/v1/workspaces/:id/tree`

- **200**: `{ spec: string[], artefatos: { artifact: string, files: string[] }[] }` — a
  read-only listing; access MUST respect the requesting user's role (spec FR-026).

### `GET /api/v1/workspaces/:id/files`

- **Query params**: `path`.
- **200**: `{ path, content }` for spec documents; binary artifact files are served via the
  `StorageProvider`, not inlined here.

## Artifacts

### `GET /api/v1/demands/:id/artifacts` / `POST /api/v1/demands/:id/artifacts`

- **POST body**: `{ name, type, technology, path, repository_ids: string[] }` — an artifact
  may reference multiple repositories and a repository may be reused across artifacts (spec
  FR-016); creating an artifact whose `repository_ids` overlaps another artifact already
  linked to the same repository does not create a duplicate `Repository`/`Branch` — it reuses
  them (spec Edge Cases).
- **201**: `Artifact`.

### `GET /api/v1/artifacts/:id` / `PATCH /api/v1/artifacts/:id`

- **200**: `Artifact`.

### `GET /api/v1/artifacts/:id/files`

- **200**: `ArtifactFile[]`.

### `POST /api/v1/artifacts/:id/files`

- **Body**: `{ file_path, change_type: "MODIFIED"|"ADDED"|"REMOVED"|"DISCOVERED", reason? }`.
- **422**: `reason` missing while `change_type = DISCOVERED` (spec FR-017 requires a
  justification for files found outside the original plan).
- **201**: `ArtifactFile`.

### `GET /api/v1/artifacts/:id/versions`

- **200**: `ArtifactVersion[]` — snapshot history of the artifact's declared scope over time.

## Specifications

### `GET /api/v1/demands/:id/specifications`

- **200**: `Specification[]`, each including `current_version_id`.

### `GET /api/v1/specifications/:id/versions`

- **200**: `SpecificationVersion[]` ordered by `version_number` — full history, nothing ever
  removed (spec FR-010).

### `POST /api/v1/specifications/:id/versions`

- **Body**: `{ content, reason }`.
- **201**: new `SpecificationVersion`; `Specification.current_version_id` is updated to point
  at it. Never overwrites a prior `SpecificationVersion` row.

### `GET /api/v1/specifications/:id/versions/:a/diff/:b`

- **200**: `{ additions: string[], deletions: string[] }` (or an equivalent diff structure) —
  powers version comparison (spec FR-011, User Story 3 Acceptance Scenario 2).

### `POST /api/v1/specifications/:id/versions/:versionId/restore`

- **200**: new `SpecificationVersion` whose `content` copies the restored version's content
  and becomes `current_version_id` — restoring never deletes the versions created after it
  (spec FR-011, User Story 3 Acceptance Scenario 3).
