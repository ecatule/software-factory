# Quickstart: AI-Assisted Specification & Increments

Prerequisites: a running `apps/api` connected to Postgres/Redis (see repo root `README.md`
Setup), an authenticated session, and — for full end-to-end validation of the AI round itself
— a real `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env` (`LLM_PROVIDER=chatgpt|claude`).
Without a real key, every step except the AI round's actual proposal content can still be
validated (the request reaches `ExecutionsProcessor`, calls the provider, and fails there —
same documented limitation as 001/002).

## Step 1 — Technology catalog (User Story 2)

1. Open **Tecnologias**, create a technology (e.g. `React`, category `Frontend`).
2. Open an existing **Projeto**, associate that technology.
3. Confirm `GET /api/v1/projects/:id/technologies` reflects it.

## Step 2 — First AI-assisted specification round (User Story 1)

1. Open a demand's **Especificação Assistida** (formerly the plain editor).
2. Fill in business input (problem/objective/context/rules) and technical input
   (screens/APIs/repos).
3. Click "Enviar para IA" — confirm the screen does **not** block; status shows
   QUEUED → RUNNING while polling `GET /executions/:id`.
4. On completion, confirm the structured proposal renders (summary, requirements, rules,
   criteria, flows, risks, questions) alongside a `specify.md`/`plan.md` draft, and that the
   associated project's technologies (Step 1) appear in the context that was sent (inspect
   `AgentExecution.input` via `GET /executions/:id`).
5. Request a second round with an adjustment; confirm a second `SpecificationVersion` exists
   and the first is still readable (not overwritten).
6. Use "Diff vs previous" to compare the two drafts.
7. Approve the second version; confirm `approvedBy`/`approvedAt` are set, and that any further
   attempt to modify that specific version is rejected (409).

## Step 3 — Direct upload alternative (User Story 1, clarify addition)

1. On a different demand (or a fresh increment), use "Anexar arquivos prontos" instead of the
   AI flow, uploading a `specify.md`/`plan.md` pair.
2. Confirm the resulting version has `source: "UPLOADED"` and follows the same
   approve/immutability rules as Step 2.
3. Confirm uploading an empty/invalid file is rejected with a clear error, not a corrupt
   draft.

## Step 4 — Increment (User Story 3)

1. On the demand from Step 2 (now with an `APPROVED` specification), click "Criar
   incremento", providing a reason (e.g. "cancelamento precisa registrar o motivo").
2. Confirm the new increment starts a round seeded with the Step 2 approved spec/plan as
   context (inspect the new execution's `input`).
3. On completion, confirm the impact summary (`changeSummary`: rules added, artifacts/APIs/
   data impacted, suggested tests) is shown.
4. Confirm the demand's increment history (Step 2's increment + this new one) both remain
   fully accessible with their own specification versions intact.
5. Attempt to create a third increment while the second is not yet approved — confirm this is
   rejected (409, FR-018).

## Expected outcome

All 3 user stories exercised end-to-end against a real Postgres instance; the AI round's
actual LLM-generated content additionally requires a real provider API key to validate fully,
consistent with this project's established live-validation limitations (see root
`README.md` Status section).
