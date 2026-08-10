# Quickstart: Advanced Console & Governance

Prerequisites: a running `apps/api` connected to the real Postgres instance; Redis is now
reachable in this environment (confirmed 2026-08-09), so BullMQ-dependent flows (including
feature 003's AI round, previously untestable) can be exercised alongside this feature's own
validation.

## Step 1 — Branches & environments (User Story 1)

1. Open a **Projeto**, fill in production/homologation branch and environment fields, save.
2. Open a **Repositório** linked to that project, fill in its own branch fields, save.
3. Open the **Especificação Assistida** of a demand under that project — confirm "Branch de
   Origem" is now pre-filled from the repository (or project, if no repository-linked
   artifact exists), not the manual placeholder from before.

## Step 2 — Granular permissions (User Story 2)

1. As admin, confirm `GET /permissions` returns all 8 catalog entries, and that the `admin`
   role already has all of them (FR-008 — no admin regression).
2. Create/use a test role without `SPECIFICATION_APPROVE`; confirm a user with only that role
   cannot see or click "Aprovar" in `SpecificationWorkspace.tsx` (FR-007a), and that a direct
   API call is also rejected with 403 naming the missing permission (FR-007).
3. Assign `SPECIFICATION_APPROVE` to that role; confirm the same user can now approve.

## Step 3 — Dashboard (User Story 3)

1. Open the Dashboard; confirm the new KPI cards (totals, PRs open, tests failing, agents
   running, by-client, avg time per stage) show correct values against real data.
2. Click through at least two KPIs; confirm each lands on `/demands` pre-filtered correctly.

## Step 4 — Demands list & Monday import (User Story 4)

1. Apply each new filter (client/project/priority/agent/period/PR) and confirm the list
   narrows correctly; confirm the new columns are visible.
2. Import a demand via a Monday external ID; confirm it appears with correct data.
3. Attempt to re-import the same external ID; confirm 409.

## Step 5 — Cockpit tabs (User Story 5)

1. Open a demand's Cockpit; confirm all 9 tabs are reachable and each shows the same
   information the old flat page used to show.
2. Copy a specific tab's URL (e.g. the Git tab), open it directly in a new session; confirm
   it opens straight into that tab (FR-019a).

## Step 6 — Manual Artifact creation (User Story 6)

1. On a demand, create an artifact manually via the new form; confirm it appears in the
   artifact list alongside any auto-discovered ones.

## Expected outcome

All 6 user stories exercised end-to-end against the real Postgres instance. With Redis now
reachable, Step 2's `AGENT_EXECUTE`-gated trigger and feature 003's AI round can additionally
be validated live in the same session — see `specs/003-ai-assisted-specification/
quickstart.md` Step 2 for that flow, now unblocked.
