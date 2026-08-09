# Implementation Plan: AI Software Factory — Core Platform

**Branch**: `001-ai-software-factory` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ai-software-factory/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build the AI Software Factory as a modular-monolith monorepo (React+TypeScript frontend,
NestJS+TypeScript backend, PostgreSQL) that takes a demand from intake through an approved
technical plan (P1: intake, SDD pipeline, spec versioning, artifact/workspace identification,
cockpit) and, in a second slice (P2), through automated implementation, a Test Gate, and an
automatically opened Pull Request. Every external dependency (demand source, LLM, code host,
SDD tooling, file storage) is reached only through a replaceable Provider interface, per the
constitution's Provider Abstraction principle, so Monday/GitHub/ChatGPT/Claude/Spec Kit can be
swapped by configuration alone.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (backend + tooling); React 18 +
TypeScript 5.x (frontend) — non-negotiable per the source technical-plan document and the
project constitution.

**Primary Dependencies**: NestJS (backend framework — module/DI system maps directly onto the
Provider Abstraction principle), Prisma (ORM/PostgreSQL access + migrations), BullMQ on Redis
(async `AgentExecution` queue), `@nestjs/swagger` (OpenAPI generation), Passport
(OAuth2/OIDC strategies) + `@nestjs/jwt` (JWT/refresh tokens), React + Vite + TanStack Query +
React Router (frontend).

**Storage**: PostgreSQL (system of record for all entities, including versioned specification
content); Redis (cache, rate-limit store, BullMQ queue); MinIO/S3 via a `StorageProvider`
(binary artifact storage only — specification documents live in Postgres, not object storage,
because they need relational diff/restore).

**Testing**: Jest + ts-jest (unit/integration), Supertest (API/contract tests against NestJS
controllers), ESLint + Prettier (lint gate), `tsc --noEmit` + `nest build` (build gate).

**Target Platform**: Linux containers via Docker Compose for the MVP (services: `web`, `api`,
`postgres`, `redis`, `minio`), designed to be Kubernetes-portable — stateless app containers,
configuration via environment variables, OpenSearch left out of the compose file for now but
not precluded later.

**Project Type**: Web application — monorepo with a `web` app and an `api` app (Option 2 below).

**Performance Goals**: the demand cockpit reflects a finished stage's result within 5 seconds
(spec SC-008), met via short-interval (2s) client polling of demand/execution status rather
than a new push/streaming subsystem — sufficient at the target scale and avoids adding
WebSocket/SSE infrastructure before it's needed.

**Constraints**: business-hours, best-effort availability (spec SC-009) — a single-region
Docker Compose/Kubernetes deployment is sufficient; no multi-region or high-availability
requirement for the MVP.

**Scale/Scope**: at least 10 demands concurrently active across development/testing/
agent-execution stages without degradation (spec SC-010) — sized for a single small pilot
team, not high concurrency; BullMQ + Redis comfortably covers this without a dedicated
message-broker cluster.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Standard | How this plan satisfies it |
|---|---|
| I. AI Agent Boundary | LLM and code-repository calls happen only inside `packages/infrastructure` provider implementations, invoked only from `apps/api` services or BullMQ workers — never from `apps/web` or any client-side code. |
| II. Provider Abstraction | `LLMProvider`, `CodeRepositoryProvider`, `DemandProvider`, `SDDProvider`, `StorageProvider` are interfaces declared in `packages/domain`/`packages/application`; concrete adapters (`MondayDemandProvider`, `GitHubRepositoryProvider`, `ChatGPTProvider`, `ClaudeProvider`, `SpecKitProvider`, `MinioStorageProvider`) live only in `packages/infrastructure`, bound via NestJS DI tokens. No domain module imports a vendor SDK directly. |
| III. Extensibility Without Core Modification | Adding a channel, Skill, or LLM is a new adapter + DI registration in `packages/infrastructure`/`packages/config` — zero edits to `packages/domain`. |
| IV. Test-Backed Quality | Jest + Supertest per NestJS module; `@nestjs/swagger` keeps API docs generated, not hand-maintained; ESLint enforces no-duplication; CI (defined in `/speckit-tasks`) runs lint + unit + integration + build before merge. |
| V. Security & Compliance by Default | Passport OAuth2/OIDC + `@nestjs/jwt` for access/refresh tokens; NestJS Guards for RBAC; `@nestjs/throttler` for rate limiting; an audit interceptor writes `AuditLog` rows on every critical operation; all secrets via environment variables only, `.env.example` committed with placeholder keys, real values never committed. |
| Technology & Data Standards | pnpm-workspaces monorepo; REST API documented via OpenAPI/Swagger; Docker Compose from day one; every Prisma model extends a shared base schema carrying `id (UUID)`, `st_ativo`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `version`; deletes are always soft (no `DELETE` statements in application code). |

**Result**: PASS — no violations. Complexity Tracking table below is intentionally empty.

**Flagged tradeoff (not a violation)**: the `workspace/` directory holding per-demand working
copies (including Git clones once the P2/MVP2 Developer Agent lands) is local filesystem,
which is in tension with Kubernetes statelessness. For the MVP this is accepted as-is (it
matches the source technical-plan document's explicit structure); when deployed to
Kubernetes, `workspace/` requires a persistent volume. Revisit moving it to object storage if
that becomes a real deployment blocker — tracked here rather than in Complexity Tracking
because it is a deployment-topology note, not a principle violation requiring justification.

**Post-Phase-1 re-check**: `data-model.md` (mandatory columns on every entity, N:N
Artifact↔Repository, data-driven Workflow), `contracts/*` (all writes behind auth/RBAC/audit,
no endpoint exposes a provider secret), and `quickstart.md` (all external-provider calls
confined to `apps/api`) do not introduce anything that changes the table above — **still
PASS, still no violations**.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-software-factory/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
software-factory/
│
├── apps/
│   ├── web/                     # React + TypeScript + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/           # Dashboard, Demands, DemandCockpit, Workspaces, Artifacts, ...
│   │   │   ├── components/
│   │   │   └── services/        # REST clients (generated from contracts/)
│   │   └── tests/
│   │
│   └── api/                     # NestJS backend
│       ├── src/
│       │   └── modules/         # Identity, Clients, Projects, Demands, Workspaces,
│       │                        # Specifications, Artifacts, Agents, Executions, Workflows,
│       │                        # Providers, Repositories, Branches, Commits, Tests,
│       │                        # PullRequests, Audit
│       └── tests/
│           ├── unit/
│           ├── integration/
│           └── contract/
│
├── packages/
│   ├── domain/                  # Entities, value objects, Provider interfaces (no I/O)
│   ├── application/              # Use cases / orchestration, depends only on domain
│   ├── infrastructure/           # Provider adapters (Monday, GitHub, ChatGPT, Claude,
│   │                              # SpecKit, MinIO), Prisma repositories, BullMQ workers
│   ├── contracts/                 # Shared DTO/OpenAPI types used by both apps/web and apps/api
│   ├── shared/                    # Cross-cutting utilities (no business logic)
│   ├── config/                    # Environment/config schema and loading
│   └── ui/                        # Shared React components/design primitives
│
├── database/
│   ├── migrations/                # Prisma migrations
│   └── seeds/
│
├── .specify/
│
├── workspace/                     # Per-demand working copies (spec/ + artefatos/); gitignored
│
├── tests/                         # Cross-app end-to-end tests
│
├── docker/
│
├── docker-compose.yml              # web, api, postgres, redis, minio
├── package.json                    # pnpm workspaces root
└── README.md
```

**Structure Decision**: Web application (Option 2 — frontend + backend), realized exactly as
`apps/web` + `apps/api` inside a pnpm-workspaces monorepo, with the domain/application/
infrastructure layering isolated into their own `packages/*` so `apps/api` depends on
`packages/domain` and `packages/application` but never the reverse, and only
`packages/infrastructure` is allowed to import third-party provider SDKs — this is what makes
the Provider Abstraction and AI Agent Boundary principles enforceable by module boundaries
rather than by convention alone.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations — table intentionally left empty.*
