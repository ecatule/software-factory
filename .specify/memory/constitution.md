<!--
Sync Impact Report
- Version change: [TEMPLATE] → 1.0.0 (initial ratification)
- Modified principles: n/a (template placeholders filled for the first time)
- Added sections:
  - Core Principles: I. AI Agent Boundary, II. Provider Abstraction, III. Extensibility
    Without Core Modification, IV. Test-Backed Quality, V. Security & Compliance by Default
  - Technology & Data Standards (SECTION_2)
  - Guiding Objectives (SECTION_3)
  - Governance (amendment procedure, versioning policy, compliance review)
- Removed sections: none
- Templates requiring follow-up: none checked in this run (constitution-only change per
  command scope guard); plan/spec/tasks templates should be reviewed for alignment the next
  time they are touched.
- Follow-up TODOs: none — all placeholders resolved from
  C:\Lico\Pessoal\spec_kit\constitution\constitution.md and project context in
  `documentos iniciais/doc-specify.md` and `documentos iniciais/doc-plan.md`.
-->

# AI Software Factory Constitution

## Core Principles

### I. AI Agent Boundary (Backend as Source of Truth)
LLMs and AI agents MUST NOT access external APIs, providers, or infrastructure directly.
Every operation MUST execute exclusively through the backend. Every decision made by an
LLM or agent MUST respect the business rules defined by the system; agents MAY propose
actions but MUST NOT bypass backend validation to execute them.
Rationale: the backend is the platform's single source of truth and audit boundary; letting
agents call providers directly would make behavior ungoverned and untraceable.

### II. Provider Abstraction (Dependency Isolation)
Every external dependency (LLMs, code hosting, demand sources, storage, search) MUST be
abstracted behind an interface (e.g. `LLMProvider`, `CodeRepositoryProvider`,
`DemandProvider`, `StorageProvider`, `SDDProvider`). No domain or business module may
depend directly on a third-party SDK or library. Integrations MUST be implemented as
Providers or Adapters in the infrastructure layer only.
Rationale: Monday, GitHub, ChatGPT, Claude, and similar vendors must be replaceable without
touching core business logic, per the product's explicit provider-substitution requirement.

### III. Extensibility Without Core Modification
The system MUST allow new communication channels, new Skills, and new AI models to be added
without modifying existing components or core business logic. Extension MUST happen through
configuration, new adapters, or new providers — never through edits to the Core's existing
contracts.
Rationale: the Software Factory is expected to grow (new demand sources, new LLMs, new agent
types, future QA/homologation/production stages) and the Core must absorb that growth without
regressions.

### IV. Test-Backed Quality
All code MUST be covered by automated tests. Duplicated code MUST be avoided in favor of
shared, reusable implementations. Every API MUST be documented (OpenAPI/Swagger). Any
architectural change MUST preserve backward compatibility for existing consumers unless a
breaking change is explicitly agreed and versioned.
Rationale: low operational cost and easy maintenance depend on catching regressions early and
keeping the codebase legible as multiple agents and contributors touch it.

### V. Security & Compliance by Default
Authentication and authorization MUST use OAuth2, OpenID Connect, and JWT with refresh
tokens; access control MUST be enforced via RBAC; rate limiting and security middleware are
required on all externally reachable endpoints. The platform MUST comply with LGPD, encrypt
sensitive data, and record audit trails for critical operations. No credential or secret MAY
ever be stored in source code; secrets MUST be supplied via environment configuration.
Rationale: the platform executes code changes and handles client data on behalf of multiple
customers, so security and regulatory compliance are non-negotiable baselines, not add-ons.

## Technology & Data Standards

**Architecture**: Monorepo; REST API described via OpenAPI/Swagger; Docker from day one and
designed to run on Kubernetes; the backend is the source of truth; structured logging is
mandatory; audit logging is mandatory; soft delete is mandatory (physical delete is
prohibited).

**Complementary infrastructure**: Redis (cache, rate limiting, lightweight queues); MinIO/S3
(file storage); OpenSearch (search and log indexing).

**Mandatory table fields**: every persisted table MUST include `id` (UUID), `st_ativo`,
`created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, and `version` (used for
optimistic locking on concurrent updates).

## Guiding Objectives

These objectives guide trade-off decisions when principles do not fully determine an answer:
low operational cost; high precision; easy maintenance; simplicity; clarity; low coupling;
high cohesion; extensibility; and evolution of the platform without modifying the Core.

## Governance

This constitution supersedes ad-hoc practice for the AI Software Factory project. All specs,
plans, tasks, and code reviews MUST verify compliance with the Core Principles above before
being approved; any deviation MUST be explicitly justified in the relevant spec/plan and
recorded, not silently introduced.

**Amendment procedure**: amendments are proposed via an update to this file (through the
`/speckit.constitution` command or an equivalent reviewed change), must state the reason for
the change, and take effect once merged. Amendments that remove or redefine a principle
require sign-off from the project owner before merging.

**Versioning policy**: this constitution follows semantic versioning.
- MAJOR: backward-incompatible governance changes, or removal/redefinition of a principle.
- MINOR: a new principle or materially expanded guidance is added.
- PATCH: clarifications, wording, or typo fixes with no semantic change.

**Compliance review**: every `/speckit.plan` and `/speckit.implement` run MUST treat this
constitution as a gate — deviations from Core Principles must be flagged in the plan's
Complexity Tracking (or equivalent) section with an explicit justification, or the work item
must be revised to comply.

**Version**: 1.0.0 | **Ratified**: 2026-08-07 | **Last Amended**: 2026-08-07
