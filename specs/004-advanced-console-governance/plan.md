# Implementation Plan: Advanced Console & Governance

**Branch**: `004-advanced-console-governance` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-advanced-console-governance/spec.md`

## Summary

Builds the six capabilities deferred from feature 003: environment/branch fields on
Project/Repository, granular RBAC permissions layered on top of the existing role system,
a richer Dashboard, an enriched/filterable Demands list plus Monday import, a tabbed
DemandCockpit (URL-linkable per Clarifications), and manual Artifact creation. Every
capability extends an existing module/entity — no new top-level domain concept, matching
this feature's own framing as "the rest of the console" rather than new product surface.

## Technical Context

**Language/Version**: TypeScript 5.5 (Node.js ≥20 backend, ES2022+DOM frontend)

**Primary Dependencies**: NestJS 10 + Prisma 5 (backend); React 18 + Vite +
`@tanstack/react-query` + `react-hook-form` + `react-router-dom` 6 (frontend); no new
packages required — same as 003's precedent.

**Storage**: PostgreSQL via Prisma (same isolated Supabase schema used by 001-003 in this
environment).

**Testing**: `tsc --noEmit` + `eslint` (static, matches 001-003 precedent); live validation
against the real Postgres instance and — new for this session — a real, now-reachable Redis
instance (`REDIS_URL` confirmed listening on 6379), so the BullMQ-dependent parts of the
platform (including feature 003's AI round, previously untestable) can also be exercised.

**Target Platform**: Web (existing NestJS REST API + React SPA), same deployment shape as
001-003.

**Project Type**: Web application (monorepo `apps/api` + `apps/web` + `packages/*`, existing
structure — no new apps/packages).

**Performance Goals**: No new goals beyond existing platform baselines.

**Constraints**: MUST NOT weaken any access control that exists today (constitution V) —
granular permissions are additive restrictions layered on top of `@Roles()`, never a
replacement that could accidentally widen access; MUST preserve `page_size` pagination caps
on every new/extended list endpoint (established SC-007-style platform rule since 002).

**Scale/Scope**: 6 user stories, 2 extended Prisma models (`Project`, `Repository`) + 0 new
tables (permissions reuse `Permission`/`RolePermission`, already modeled since 001) + 1
schema-adjacent instrumentation change (workflow stage transitions now write an `AuditLog`
row, needed for FR-011's "avg time per stage" — see research.md), ~4 backend modules
extended (`identity`, `dashboard`, `demands`, `projects`/`repositories`), 0 new backend
modules, ~6 frontend pages extended + 1 page (`DemandCockpit.tsx`) restructured.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. AI Agent Boundary** — PASS. No AI/agent-facing surface is touched by this feature;
  the Monday import (FR-015) reuses the existing `DemandProvider` interface, called only from
  `apps/api` (never from `apps/web`), unchanged from its 001 implementation.
- **II. Provider Abstraction** — PASS. FR-015 explicitly requires reusing `DemandProvider`
  "sem acoplar a UI diretamente ao Monday" — the frontend only ever calls a new
  `POST /demands/import` endpoint on `apps/api`, never Monday's API or `MondayDemandProvider`
  directly.
- **III. Extensibility Without Core Modification** — PASS. Granular permissions extend
  `RbacGuard` with an additional metadata check (`@RequirePermission()`) alongside the
  existing `@Roles()` check, not a parallel guard or a rewrite; existing `@Roles()`-gated
  endpoints (e.g. Settings) are untouched. Dashboard/Demands-list extensions are additive
  fields/filters on existing endpoints.
- **IV. Test-Backed Quality** — Same established caveat as 001-003 (no automated test suite
  in this repo yet; `tsc`/`eslint` + live validation is the practice). OpenAPI/Swagger
  decorators required on every new/changed endpoint, matching existing controllers.
- **V. Security & Compliance by Default** — PASS, and this feature is largely *in service of*
  this principle (User Story 2 exists specifically to strengthen RBAC). FR-008 explicitly
  guards against the one real risk (accidentally locking out existing admins) by granting the
  full permission catalog to the `admin` role by default.
- **Technology & Data Standards** — PASS. `Project`/`Repository` extensions are plain nullable
  string columns (no new table, so the mandatory-columns rule doesn't add new obligations);
  no physical deletes introduced.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-advanced-console-governance/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Existing monorepo layout — no new apps or packages.

```text
apps/api/
├── prisma/schema.prisma        # + Project/Repository branch+environment columns
│                                #   (no new tables — Permission/RolePermission reused)
└── src/modules/
    ├── identity/
    │   ├── auth/auth.service.ts        # EXTENDED — JWT payload gains `permissions[]`
    │   ├── auth/jwt.strategy.ts        # EXTENDED — JwtPayload type gains `permissions[]`
    │   └── guards/
    │       ├── rbac.guard.ts            # EXTENDED — also checks @RequirePermission()
    │       └── permissions.decorator.ts # NEW — @RequirePermission(...)
    ├── dashboard/dashboard.service.ts   # EXTENDED — new KPI aggregations
    ├── workflows/workflows.service.ts   # EXTENDED — writes an AuditLog row on every
    │                                    #   stage transition (research.md finding)
    ├── demands/
    │   ├── demands.service.ts           # EXTENDED — richer list() filters/columns,
    │   │                                #   importFromProvider() exposed via new endpoint
    │   └── demands.controller.ts        # EXTENDED — POST /demands/import
    ├── projects/                        # EXTENDED — branch/environment fields
    └── repositories/                    # EXTENDED — branch fields

apps/web/src/
├── context/AuthContext.tsx          # EXTENDED — carries `permissions[]`, exposes
│                                    #   `useHasPermission()`
├── pages/
│   ├── Dashboard.tsx                 # EXTENDED — new KPI cards, click-through
│   ├── Demands.tsx                   # EXTENDED — columns/filters, Monday import action
│   ├── DemandCockpit.tsx             # RESTRUCTURED — tab shell + `:tab` URL param
│   ├── Projects.tsx                  # EXTENDED — branch/environment fields
│   ├── Repositories.tsx              # EXTENDED — branch fields
│   └── Artifacts.tsx                 # EXTENDED — manual-creation form
└── components/cockpit-tabs/          # NEW — one small component per tab, each just the
                                       #   content already in DemandCockpit.tsx today,
                                       #   relocated (Summary/Specification/Artifacts/
                                       #   Development/Tests/Git/Timeline/Audit/Tasks)
```

**Structure Decision**: Extends existing modules/pages in place; no new backend modules, one
new small frontend component group (`cockpit-tabs/`) purely to split the already-existing
cockpit sections into per-tab files, and two new small decorator/guard-extension files for
permissions. Mirrors the "extend, don't duplicate" pattern already established in 003.
