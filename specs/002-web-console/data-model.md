# Data Model: Web Console — Administrative Screens

## No new persisted entities

This feature is a UI layer over the entities already defined in
`specs/001-ai-software-factory/data-model.md` (Client, Project, Demand, DemandWorkspace,
Artifact, ArtifactFile, Specification, SpecificationVersion, Workflow/WorkflowStage/
WorkflowTransition, Agent, AgentExecution, Provider, ProviderConfiguration, Repository,
Branch, Commit, PullRequest, TestExecution, TestResult, AuditLog, User/Role/Permission).
Nothing here adds, removes, or changes a Prisma model or table. The new backend surface
(see `plan.md`'s endpoint inventory) is entirely new **read/write endpoints** over existing
tables — no schema migration is part of this feature.

## Shared pagination envelope

Every new/extended list endpoint (`GET /workspaces`, `/artifacts`, `/executions`,
`/repositories`, `/branches`, `/commits`, `/pull-requests`, `/audits`,
`/providers/:id/configurations`) returns:

```text
{
  items: T[],
  total: number,
  page: number,
  page_size: number
}
```

matching the envelope 001's `GET /demands` already established (see
`specs/001-ai-software-factory/contracts/demands.md`). Accepts `page` and `page_size` query
parameters; `page_size` is capped server-side (e.g. 100) regardless of what's requested, so a
client can't defeat SC-007's pagination requirement by asking for an unbounded page.

## Non-persisted read-model: DashboardSummary

Computed on demand by `GET /dashboard/summary` (see `contracts/dashboard.md`) from existing
tables — not stored anywhere itself:

```text
DashboardSummary {
  stageCounts: { stage: string, count: number }[]   // one row per WorkflowStage.key present on at least one Demand
  recentDemands: Demand[]                            // N most recently updated demands (N configurable, default 10)
}
```

## Auth session shape (not persisted beyond the existing User/Role tables)

`GET /auth/session` and the OIDC callback produce the same JWT payload shape 001's
`AuthService`/`JwtStrategy` already define (`{ sub, email, roles }`) — no new identity fields
are introduced. The httpOnly refresh cookie carries the same refresh JWT 001 already issues;
only *where* it's stored changes (cookie instead of the response body), not its content or the
`User`/`Role`/`Permission` tables behind it.
