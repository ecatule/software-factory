# Quickstart: AI Software Factory — Core Platform (P1 slice)

Validates the P1 user stories from `spec.md` (User Stories 1–5: demand intake, specification
pipeline, spec versioning, artifact/workspace identification, cockpit) end-to-end against a
local environment. P2 (Developer Agent, Test Gate, Git/PR) has its own quickstart addendum
once `apps/api`'s repository/test-runner modules exist — not required to validate P1.

## Prerequisites

- Docker + Docker Compose
- Node.js 20 LTS, pnpm
- A `.env` file copied from `.env.example` (see `contracts/supporting-resources.md` for which
  values are provider `settings` vs. secrets — secrets go in `.env`, never in the database)

## Setup

```bash
pnpm install
docker compose up -d postgres redis minio
pnpm --filter api prisma migrate deploy
pnpm --filter api prisma db seed        # creates a default admin User, Role, Permission set
pnpm --filter api start:dev
pnpm --filter web dev
```

## Scenario: walk a demand from intake to Analyze (validates SC-001, SC-008)

1. **Create a Client and Project**
   `POST /api/v1/clients` → `POST /api/v1/projects` (referencing the client).
2. **Register Providers for local dev**
   `POST /api/v1/providers/:id/configurations` for the `SDD` provider (SpecKit,
   pointed at a local Spec Kit checkout) and the `LLM` provider (either ChatGPT or Claude,
   using an API key from `.env`, never from the request body).
3. **Import a demand**
   `POST /api/v1/demands` with a synthetic `external_id`/`origin: "monday"`.
   - Expect **201** with `status: "NEW"`.
   - Re-POST the same `external_id`/`origin` → expect **409** (spec FR-028 re-import rule).
4. **Run the specification pipeline**
   `POST /api/v1/executions` with `agent_id` = the Specification Agent, `demand_id` = the
   demand above, for each stage in order: Specify → Clarify → Plan → Checklist → Tasks →
   Analyze.
   - After each execution reaches `status: "COMPLETED"`, `GET /api/v1/demands/:id` and
     confirm `status` has advanced to match, **within 5 seconds** of completion (validates
     SC-008's polling-based freshness target).
   - `GET /api/v1/demands/:id/specifications` and confirm one `Specification` per document
     type produced so far, each with a `current_version_id`.
5. **Edit and version a specification**
   `POST /api/v1/specifications/:id/versions` with edited `content`.
   - `GET /api/v1/specifications/:id/versions` and confirm 2 versions exist, the first intact.
   - `POST /api/v1/specifications/:id/versions/:oldId/restore` and confirm a **3rd** version
     is created (not a mutation of version 1), now current (spec FR-011).
6. **Identify artifacts and create the workspace**
   `POST /api/v1/demands/:id/artifacts` for each artifact identified in the plan.
   - `GET /api/v1/demands/:id/workspace` → confirm `DemandWorkspace.path` exists on disk at
     `workspace/<ticket>-<slug>/` with exactly a `spec/` and an `artefatos/` subfolder (spec
     User Story 4, FR-013/FR-014).
7. **View the cockpit**
   `GET /api/v1/demands/:id/workflow` and `GET /api/v1/demands/:id/timeline` — confirm the
   workflow view distinguishes completed/current/pending stages, and the timeline lists every
   event from step 3 onward in chronological order (spec User Story 5).

## Expected outcome

All of the above succeed without any request needing to reach Monday, GitHub, ChatGPT/Claude,
or Spec Kit directly from `apps/web` — every external call happens inside `apps/api`'s
`packages/infrastructure` adapters, satisfying the AI Agent Boundary and Provider Abstraction
principles while exercising the P1 acceptance criteria from `spec.md`.
