# Implementation Plan: AI-Assisted Specification & Increments

**Branch**: `003-ai-assisted-specification` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-ai-assisted-specification/spec.md`

## Summary

Turn the platform's dormant `LLMProvider` infrastructure into the actual specification
copilot described by the product's core value proposition. Adds a `Technology` catalog
(N:N with `Project`) and an `Increment` entity so a `Demand` can evolve through independent
rounds of specification, then wires a new async pipeline — reusing the existing
`AgentExecution` + BullMQ queue used by the Developer Agent — that assembles a
`SpecificationContext`, calls `LLMProvider.generateStructured()`, and produces a reviewable,
versioned, human-approved `SpecificationVersion` draft. Also adds a direct-upload path for
analysts who already have `specify.md`/`plan.md` from elsewhere. No new persistence
subsystem, no new queue, no new LLM adapters — this is almost entirely new orchestration on
top of existing building blocks.

## Technical Context

**Language/Version**: TypeScript 5.5 (Node.js ≥20 backend, ES2022+DOM frontend)

**Primary Dependencies**: NestJS 10 + Prisma 5 + `@nestjs/bullmq`/BullMQ (backend); React 18 +
Vite + `@tanstack/react-query` + `react-hook-form` (frontend); existing
`packages/domain`/`packages/infrastructure` Provider Abstraction (`LLMProvider`,
`ClaudeProvider`, `ChatGPTProvider`)

**Storage**: PostgreSQL via Prisma (same isolated Supabase schema used by 001/002 in this
environment); Redis via BullMQ for the async execution queue (already provisioned for the
Developer Agent)

**Testing**: `tsc --noEmit` + `eslint` (static, matches 001/002 precedent); live validation
against the real Postgres instance where infra allows, same methodology as 001/002

**Target Platform**: Web (existing NestJS REST API + React SPA), same deployment shape as
001/002

**Project Type**: Web application (monorepo `apps/api` + `apps/web` + `packages/*`, existing
structure — no new apps/packages)

**Performance Goals**: No new goals beyond existing platform baselines; the AI round is
explicitly async (Clarifications 2026-08-09) precisely so LLM latency (seconds to ~1 min)
never blocks a request thread or the UI

**Constraints**: MUST reuse `LLMProvider`/`AgentExecution`/BullMQ rather than introduce a
parallel mechanism (Provider Abstraction + Extensibility principles); MUST NOT let the
frontend call an LLM provider directly (AI Agent Boundary); a `SpecificationVersion`, once
`APPROVED`, MUST become immutable at the data layer, not just by UI convention

**Scale/Scope**: 3 user stories, ~2 new Prisma models + 1 join table + ~8 new columns on
`SpecificationVersion`/`Demand`, ~2 new backend modules (`technologies`, `increments`) plus
extensions to `specifications`/`executions`, ~2 new frontend screens
(`SpecificationWorkspace`, `Technologies`) plus extensions to `Projects`/`DemandCockpit`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. AI Agent Boundary** — PASS. The LLM is only ever called from
  `ExecutionsProcessor` (a BullMQ worker inside `apps/api`), identical to how the Developer
  Agent already works; `apps/web` only ever calls the existing `POST /executions` /
  `GET /executions/:id` REST surface and never imports `packages/infrastructure`.
- **II. Provider Abstraction** — PASS. Reuses the existing `LLMProvider` interface and its
  `ClaudeProvider`/`ChatGPTProvider` adapters unchanged; no new coupling to a vendor SDK
  anywhere in `packages/domain` or the API layer.
- **III. Extensibility Without Core Modification** — PASS. New capability is additive:
  new Prisma models, new columns, a new branch inside the existing `ExecutionsProcessor`
  keyed on `agent.type`, new controllers/modules — no existing endpoint's contract changes
  except where the spec explicitly extends it (e.g. `SpecificationVersion` gains columns,
  doesn't lose any).
- **IV. Test-Backed Quality** — PASS (with the project's established caveat): this repo has
  no automated test suite yet for 001/002 either (`tsc`/`eslint` + live validation is the
  established practice) — this feature follows the same, not a new deviation. OpenAPI/Swagger
  decorators required on every new endpoint, matching existing controllers.
- **V. Security & Compliance by Default** — PASS. All new endpoints sit behind the existing
  global `JwtAuthGuard`; per Clarifications, approval requires only authentication (no new
  role), consistent with today's baseline — no weakening of existing guards.
- **Technology & Data Standards** — PASS. Every new table carries the mandatory
  `id/st_ativo/created_at/updated_at/deleted_at/created_by/updated_by/version` columns; soft
  delete only; structured logging/audit inherited from the existing global
  `AuditInterceptor`.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-ai-assisted-specification/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Existing monorepo layout (`apps/api`, `apps/web`, `packages/*`) — no new apps or packages.

```text
apps/api/
├── prisma/schema.prisma          # + Technology, ProjectTechnology, Increment models;
│                                  #   + columns on SpecificationVersion/Demand
├── prisma/seed.ts                # + seed the "SpecificationCopilotAgent" catalog row
└── src/modules/
    ├── technologies/              # NEW — Technology CRUD + Project association
    ├── increments/                # NEW — Increment creation + listing on a Demand
    ├── specifications/            # EXTENDED — approve endpoint, upload endpoint,
    │                              #   context-assembly service, extended createVersion()
    └── executions/
        ├── executions.processor.ts   # EXTENDED — new branch for
        │                              #   agent.type === "specification_copilot"
        └── dto/execution.dto.ts      # EXTENDED — CreateExecutionDto gains `input`

apps/web/src/
├── pages/
│   ├── SpecificationWorkspace.tsx  # NEW — replaces SpecificationEditor.tsx as the route
│   │                                #   target; embeds the existing version/diff history
│   └── Technologies.tsx            # NEW — CRUD screen, same pattern as Clients.tsx
├── services/
│   ├── useTechnologies.ts          # NEW
│   ├── useIncrements.ts            # NEW
│   ├── useSpecificationCopilot.ts  # NEW — trigger round, poll execution, approve, upload
│   └── useSpecificationVersions.ts # EXTENDED — createVersion payload gains
│                                    #   incrementId/source; new approve() call
├── pages/Projects.tsx              # EXTENDED — technology multi-select field
└── pages/DemandCockpit.tsx         # EXTENDED — "Criar incremento" action, current
                                     #   increment badge
```

**Structure Decision**: Extends the existing NestJS modular-monolith backend and React SPA
frontend in place — no new top-level app or package. Backend: two new feature modules
(`technologies`, `increments`) following the existing controller+service+module+dto pattern
(e.g. `apps/api/src/modules/clients/`), plus targeted extensions to two existing modules
(`specifications`, `executions`) rather than new parallel ones. Frontend: two new pages
following the existing `DataTable`/`FormField`/`Modal` pattern, plus one page replaced
in-place (`SpecificationEditor.tsx` → `SpecificationWorkspace.tsx`, reusing its version
history/diff section as a sub-block) and two existing pages extended.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
