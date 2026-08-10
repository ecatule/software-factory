# Contract: Cockpit tabs & manual Artifact creation

Implements spec FR-017 through FR-021 (User Stories 5, 6). No new backend endpoints for the
Cockpit tabs themselves — pure frontend restructuring (research.md §9).

## `POST /api/v1/demands/:demandId/artifacts` (unchanged, existing endpoint since 001)

Already accepts `{type, name, description?, technology?, path?, repositoryId?}` and creates
an `Artifact`. This feature only adds the frontend form that calls it (research.md §10) — no
contract change.

## Frontend contract — Cockpit tabs

- Route: `/demands/:demandId/:tab` (`tab` ∈ `summary | specification | artifacts | tasks |
  development | tests | git | timeline | audit`), `/demands/:demandId` redirects to
  `/demands/:demandId/summary`.
- `DemandCockpit.tsx` becomes a shell: tab nav (URL-linkable, Clarifications 2026-08-09) +
  the active tab's component from `components/cockpit-tabs/`. Data is fetched once at the
  shell level via the existing `useDemandPolling` (fetch-once + manual "Atualizar", per the
  earlier bug-fix round in this session) and passed down as props — no per-tab re-fetch
  (FR-019).
- `TasksTab.tsx` renders a placeholder explaining task-tracking isn't implemented yet
  (FR-017 Acceptance Scenario 3) — not backed by any endpoint.

## Frontend contract — manual Artifact creation

`Artifacts.tsx` gains a "New artifact" action opening a `Modal` with a `FormField`-based form
(type/name/description/repository/path/technology), submitting via a new
`useCreateArtifact(demandId)` hook in `useArtifacts.ts` calling the endpoint above. The
created artifact appears in the same list as auto-discovered ones (FR-021) — no visual
distinction required by the spec beyond what already exists.
