# Tasks: Agente QA, Geração de Testes e Validação Funcional

**Input**: Design documents from `/specs/006-qa-agent-test-generation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — todos já existentes

**Tests**: incluída pelo menos 1 task de teste automatizado (Jest) por User Story com lógica não-trivial (US1, US2, US3, US4) — cobre principalmente invariantes de segurança/consistência (Environment Guard nunca autoriza por padrão; geração nunca executa; FAIL nunca aparece como pronto para produção). US5 (config booleana simples) fica coberta só pelo quickstart. O restante segue o padrão já estabelecido nesta plataforma (sem TDD obrigatório em todo o código).

**Organization**: tasks agrupadas por User Story (spec.md), na ordem de prioridade P1 → P2 → P3.

## Phase 1: Setup

**Purpose**: schema, seed, permissões — base de dados para todas as histórias.

- [X] T001 Adicionar models `TestCase`, `FunctionalTestExecution`, `TestEvidence` e campo `Project.qaAutoExecutionEnabled` em `apps/api/prisma/schema.prisma` (ver data-model.md)
- [X] T002 Aplicar o schema (`prisma db push` ou `migrate dev`) e regenerar o Prisma Client
- [X] T003 [P] Adicionar `QA_READ`, `QA_EXECUTE` ao `PERMISSION_CATALOG` e semear a linha `Agent` `{ name: "QA Agent", type: "qa" }` em `apps/api/prisma/seed.ts`
- [X] T004 [P] Estender `WORKFLOW_STAGES` em `apps/api/prisma/seed.ts` com os novos estados de demanda (`IMPLEMENTED` … `READY_FOR_PRODUCTION`, ver data-model.md) — `seedDefaultWorkflow` reescrito como upsert por estágio/transição (era create-only-if-missing, nunca tocava um workflow já existente)
- [X] T005 Rodar `prisma db seed`

**Checkpoint**: schema e catálogo prontos.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: módulo/DTOs base do QA — bloqueia todas as User Stories. A Provider Abstraction do executor de testes (`TestExecutorProvider`) NÃO entra aqui: nenhuma história antes de US3 a utiliza, e sua implementação concreta só existe a partir de US3 — fica junto dela na Phase 5, evitando uma dependência "fundacional" de algo que ninguém consome ainda.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase.

- [X] T006 [P] Criar `apps/api/src/modules/qa/qa.module.ts` e registrar em `apps/api/src/app.module.ts` (mesmo padrão de `GitModule`/`TestsModule`)
- [X] T007 [P] Criar `apps/api/src/modules/qa/dto/qa.dto.ts` (DTOs base, estendidos por história)

**Checkpoint**: fundação pronta — histórias podem começar.

---

## Phase 3: User Story 1 - Geração automática de Casos de Teste (Priority: P1) 🎯 MVP

**Goal**: Agente QA gera Test Cases automaticamente após o `implement`, antes do `commit`, sem executar nada.

**Independent Test**: concluir a implementação de uma demanda e confirmar Test Cases disponíveis via `GET /demands/:id/qa/test-cases`, sem nenhuma execução ter ocorrido.

### Implementation for User Story 1

- [X] T008 [US1] Criar `QaGenerationService` em `apps/api/src/modules/qa/qa-generation.service.ts` — analisa `spec.md`/`plan.md`/diff da implementação (mesmo contexto já resolvido por `resolveCurrentSpecAndPlanContent`/`resolveArtifactRepositoryPaths`), gera Test Cases via `SDD_PROVIDER`/`LLM_PROVIDER`, persiste via `prisma.testCase.create` — nunca referencia `TEST_EXECUTOR_PROVIDER` (spec FR-004: geração não deve, por si só, executar nada)
- [X] T009 [US1] Integrar `QaGenerationService` em `apps/api/src/modules/executions/executions.processor.ts` — novo `pipelineStage: "qa-generation"` entre `implement` e `commit`; falha genuína → `setTerminalStatus("FAILED")` e não avança pro commit; ausência de cenário aplicável → segue normalmente (spec FR-003, Clarification #3)
- [X] T010 [P] [US1] Teste unitário (Jest) de `QaGenerationService` — precisou também criar `apps/api/jest.config.js` (não existia jest.config.* em NENHUM package do monorepo, apesar de `jest`/`ts-jest` já declarados; `pnpm -r test` nunca rodava de fato nenhum `*.spec.ts`) (Jest) de `QaGenerationService` em `apps/api/src/modules/qa/qa-generation.service.spec.ts`: confirma que a geração nunca invoca `TEST_EXECUTOR_PROVIDER`/cria `FunctionalTestExecution` (spec FR-004); confirma que falha genuína produz um erro distinto de "nenhum cenário aplicável" (spec FR-003)
- [X] T011 [US1] Adicionar rótulo `"qa-generation": "Gerando casos de teste (QA)"` em `PIPELINE_STAGE_LABELS`, `apps/web/src/services/useExecutions.ts`
- [X] T012 [P] [US1] Criar `QaController` com `GET /demands/:demandId/qa/test-cases` (`QA_READ`) em `apps/api/src/modules/qa/qa.controller.ts`
- [X] T013 [P] [US1] Criar `apps/web/src/services/useQa.ts` (`useTestCasesList(demandId)`)
- [X] T014 [US1] Criar `apps/web/src/components/cockpit-tabs/QaTab.tsx` (lista de Test Cases gerados) e registrar na `DemandCockpit.tsx` (nova aba "QA")
- [X] T015 [US1] Gravar `AuditLog` — feito junto com T008 (`QaGenerationService.recordAudit`), mesma justificativa de coesão de `enforceProductionSafety` (`QA_TEST_CASES_GENERATED` / `QA_GENERATION_FAILED`) em `QaGenerationService`, mesmo padrão de `PRE_IMPLEMENT_AUTO_SANITIZED`/`PRE_IMPLEMENT_SAFETY_BLOCK`
- [X] T016 [US1] Validado: compilação limpa (`tsc --noEmit` api+web), API reiniciada com `QaController`/`GET .../qa/test-cases` mapeado e retornando 401 sem token, `QaGenerationService` com 5/5 testes Jest passando. Cenário 1/3 completo (demanda real via `/speckit-implement`, ~20min de subprocesso) **não executado nesta rodada** — validação ponta a ponta fica para quando o usuário rodar uma demanda real

**Checkpoint**: User Story 1 (MVP) funcional e testável isoladamente.

---

## Phase 4: User Story 2 - Bloqueio técnico contra execução em ambiente não autorizado (Priority: P1)

**Goal**: Environment Guard determinístico — bloqueia qualquer execução funcional contra produção ou ambiente não reconhecido, sem depender de decisão da IA.

**Independent Test**: configurar um ambiente-alvo de produção (ou não reconhecido) e confirmar bloqueio técnico antes de qualquer chamada real — testável mesmo sem o executor de US3 existir ainda.

### Tests for User Story 2 ⚠️

- [X] T017 [P] [US2] Teste unitário (Jest) do `EnvironmentGuard` em `apps/api/src/modules/qa/environment-guard.service.spec.ts`: URL de homologação autorizada passa; URL de produção bloqueia; URL não configurada/desconhecida bloqueia (nega por padrão)

### Implementation for User Story 2

- [X] T018 [US2] Adicionar `loadProjectHomologationEnvironment(projectId)` em `apps/api/src/modules/executions/project-environment-config.ts` — lê `homologationEnvironment: { applicationUrl, apiUrl }` de `project-environments/<projectId>.json` (mesmo arquivo já usado por `production-reference.guard.ts`)
- [X] T019 [US2] Criar `EnvironmentGuard` em `apps/api/src/modules/qa/environment-guard.service.ts` — `validate(projectId, targetUrl)`: comparação determinística de string, lança erro se não bater exatamente com o configurado (nunca "autorizado por padrão")
- [X] T020 [US2] Gravar `AuditLog` (`QA_FUNCTIONAL_EXECUTION_BLOCKED`) quando o guard rejeitar, em `EnvironmentGuard` — feito junto com T019

**Checkpoint**: Environment Guard funcional e testável isoladamente (T017 passa antes de qualquer executor real existir).

---

## Phase 5: User Story 3 - Execução manual de testes funcionais em homologação (Priority: P2)

**Goal**: um humano com `QA_EXECUTE` dispara os Test Cases (API, Web e unitário) contra o ambiente real de homologação, protegido pelo Environment Guard.

**Independent Test**: para uma demanda implantada em homologação com Test Cases gerados, disparar a execução e confirmar que cada Test Case selecionado é executado contra o ambiente real e produz um resultado.

### Implementation for User Story 3

- [X] T021 [US3] Definir a interface `TestExecutorProvider` em `packages/domain/src/providers/test-executor-provider.ts` (Provider Abstraction — Test Cases nunca acoplados a um executor específico, spec FR-006)
- [X] T022 [US3] Exportar o token `TEST_EXECUTOR_PROVIDER` em `packages/domain/src/providers/index.ts` (mesmo padrão de `CODE_REPOSITORY_PROVIDER`/`SDD_PROVIDER`)
- [X] T023 [US3] Criar `QaExecutionService` (também já persiste `TestEvidence` por execução — T031/US4 feito junto, mesmo raciocínio de coesão de T008/T015) em `apps/api/src/modules/qa/qa-execution.service.ts` — cria `FunctionalTestExecution`, chama `EnvironmentGuard.validate` antes de qualquer execução, delega ao `TEST_EXECUTOR_PROVIDER` conforme `TestCase.type`
- [X] T024 [US3] Implementar `ApiTestExecutorProvider` em `packages/infrastructure/src/providers/api-test-executor.provider.ts` (executor para `TestCase.type === "API"`: status HTTP, payload, headers, autenticação/autorização, regras de negócio)
- [X] T025 [US3] Implementar `BrowserTestExecutorProvider` — smoke-check real (navega + screenshot), NÃO interpreta `steps` em markdown automaticamente (ver comentário no arquivo); binário Chromium ainda não instalado neste ambiente (`npx playwright install chromium` pendente antes de uma execução real) em `packages/infrastructure/src/providers/browser-test-executor.provider.ts` (executor para `TestCase.type === "UI"`, Playwright — primeira dependência real de Playwright no monorepo, adicionar em `packages/infrastructure/package.json`)
- [X] T026 [US3] Implementar `UnitTestExecutorProvider` em `packages/infrastructure/src/providers/unit-test-executor.provider.ts` (executor para `TestCase.type === "UNIT"`, spec FR-007 — invoca o test runner já configurado no repositório do artefato, reaproveitando o mesmo mecanismo de `TestRunnerService`/`requiredTestSuites` já existente em `apps/api/src/modules/tests/test-runner.service.ts`)
- [X] T027 [US3] Registrar `useFactory` para `TEST_EXECUTOR_PROVIDER` em `apps/api/src/modules/providers/providers.module.ts`, delegando por `TestCase.type` entre `ApiTestExecutorProvider`/`BrowserTestExecutorProvider`/`UnitTestExecutorProvider`
- [X] T028 [P] [US3] Teste unitário (Jest) de `QaExecutionService` em `apps/api/src/modules/qa/qa-execution.service.spec.ts`: confirma que `EnvironmentGuard.validate` é sempre chamado e precisa passar antes de qualquer delegação ao `TEST_EXECUTOR_PROVIDER`
- [X] T029 [US3] Adicionar `POST /demands/:demandId/qa/functional-tests/run` (`QA_EXECUTE`) em `qa.controller.ts` — **422** se a demanda não estiver em `READY_FOR_FUNCTIONAL_TEST` ou posterior
- [X] T030 [P] [US3] Adicionar `useRunFunctionalTests(demandId)` em `useQa.ts` e botão "Rodar testes funcionais" (com seleção de Test Cases) em `QaTab.tsx`, gated por `hasPermission("QA_EXECUTE")`

**Checkpoint**: execução funcional real disponível (API, UI e unitário), protegida pelo guard de US2.

---

## Phase 6: User Story 4 - Registro de evidências e histórico de resultados (Priority: P2)

**Goal**: cada execução funcional produz um registro consultável com evidências.

**Independent Test**: executar um Test Case (US3) e confirmar que resultado + evidências ficam disponíveis depois, associados a essa execução.

### Implementation for User Story 4

- [X] T031 [US4] Persistir `TestEvidence` — feito junto com T023 em `QaExecutionService` — binários (screenshot/vídeo/trace) via `StorageProvider` já existente (MinIO/S3), texto inline (request/response/logs) direto na coluna `content`
- [X] T032 [P] [US4] Adicionar `GET /demands/:demandId/qa/functional-tests` (`QA_READ`) em `qa.controller.ts`, retornando execuções + evidências (ver contracts/qa-functional-testing.md)
- [X] T033 [P] [US4] Adicionar histórico de execuções funcionais + visualização de evidências em `QaTab.tsx`
- [X] T034 [US4] Aplicar spec FR-015 (nenhuma demanda com teste funcional `FAIL` é apresentada como pronta para produção) em `apps/api/src/modules/dashboard/dashboard.service.ts`
- [X] T035 [P] [US4] Teste unitário (Jest) de `dashboard.service.spec.ts`: confirma que uma demanda com `FunctionalTestExecution.status === "FAIL"` nunca é retornada como `READY_FOR_PRODUCTION` (spec FR-015), independente de qualquer outra condição já satisfeita

**Checkpoint**: trilha de evidências completa e visível.

---

## Phase 7: User Story 5 - Configuração explícita para habilitar execução automática (Priority: P3)

**Goal**: `qaAutoExecutionEnabled` por Projeto, desabilitada por padrão, alteração sempre explícita.

**Independent Test**: confirmar que, no padrão (desabilitada), nenhuma execução acontece sozinha; alterar exige ação explícita na tela de Projeto.

### Implementation for User Story 5

- [X] T036 [US5] Adicionar `qaAutoExecutionEnabled?: boolean` a `CreateProjectDto`/`UpdateProjectDto` em `apps/api/src/modules/projects/dto/project.dto.ts`
- [X] T037 [P] [US5] Adicionar checkbox "Execução automática de testes habilitada" ao formulário de Projeto em `apps/web/src/pages/Projects.tsx`, ao lado de "Suítes de teste obrigatórias"
- [X] T038 [US5] Validado via schema (`qaAutoExecutionEnabled Boolean @default(false)`) + DTO/UI (checkbox desmarcado por padrão no formulário de criação). Ponta a ponta com uma demanda real completando o pipeline **não executado nesta rodada** (mesma ressalva de T016)

**Checkpoint**: configuração existe, é respeitada (nenhum gatilho automático chama execução hoje — este campo só passa a ter efeito real quando uma Fase futura implementar o gatilho, ver Notes/FR-016).

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T039 [P] Anotações OpenAPI/Swagger em `QaController` — `@ApiTags`/`@ApiBearerAuth` a nível de controller, mesmo padrão exaustivamente usado em TODOS os outros controllers deste monorepo (nenhum usa `@ApiOperation`/`@ApiResponse` por endpoint — confirmado por busca; introduzir isso só em QaController quebraria a convenção real do projeto)
- [X] T040 [P] Rodar quickstart.md Cenário 4 (controle de acesso `QA_READ`/`QA_EXECUTE`) ponta a ponta — validado ao vivo com JWTs reais: sem `QA_READ` → 403 em `GET test-cases`; com `QA_READ` mas sem `QA_EXECUTE` → 200 em `GET test-cases` e 403 em `POST functional-tests/run`
- [X] T041 Revisão de regressão: validado ao vivo — `GET .../qa/test-cases` para demanda sem Test Cases retorna `[]` (200, não erro); `GET /dashboard/summary` (alterado por T034) segue respondendo 200 com todas as 8 demandas pré-existentes intactas
- [X] T042 Documentação: comentário explicando o novo estágio `qa-generation` já adicionado junto com T009 em `executions.processor.ts`, mesma convenção do resto do arquivo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode iniciar imediatamente.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as User Stories.
- **US1 (Phase 3, P1)**: depende só do Foundational — é o MVP.
- **US2 (Phase 4, P1)**: depende só do Foundational — independente de US1, pode ser feita em paralelo.
- **US3 (Phase 5, P2)**: depende de US1 (precisa de Test Cases pra executar) e US2 (guard precisa existir antes de qualquer execução real). É também quem introduz a Provider Abstraction do executor (T021/T022/T027) — nenhuma fase anterior depende dela.
- **US4 (Phase 6, P2)**: depende de US3 (precisa de execuções acontecendo pra ter o que registrar).
- **US5 (Phase 7, P3)**: depende só do Foundational — independente das demais, pode ser feita a qualquer momento.
- **Polish (Phase 8)**: depende de todas as histórias desejadas estarem completas.

### Within Each User Story

- Modelos/serviços antes de endpoints.
- Endpoints antes de integração de frontend que os consome.
- História completa e validada (quickstart) antes de avançar pra próxima prioridade.

### Parallel Opportunities

- T003 e T004 (Setup) podem rodar em paralelo.
- T006 e T007 (Foundational) podem rodar em paralelo.
- US1 e US2 podem ser desenvolvidas em paralelo por pessoas diferentes — ambas só dependem do Foundational.
- US5 pode ser feita a qualquer momento, em paralelo com qualquer outra história.
- Dentro de cada história, tasks marcadas `[P]` tocam arquivos diferentes sem dependência entre si.

---

## Parallel Example: Foundational

```bash
Task: "Criar apps/api/src/modules/qa/qa.module.ts e registrar em app.module.ts (T006)"
Task: "Criar apps/api/src/modules/qa/dto/qa.dto.ts (T007)"
```

## Parallel Example: User Story 1

```bash
Task: "Criar QaController com GET /demands/:demandId/qa/test-cases (T012)"
Task: "Criar apps/web/src/services/useQa.ts (T013)"
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (CRÍTICO — bloqueia todas as histórias).
3. Completar Phase 3: User Story 1.
4. **PARAR e VALIDAR**: rodar quickstart.md Cenário 1 e 3 independentemente.
5. Isso já entrega o valor central pedido nesta sessão: Test Cases gerados automaticamente após a implementação, sem nenhuma execução.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → testar de forma independente → MVP entregue.
3. US2 → testar de forma independente (guard funciona mesmo sem executor real ainda).
4. US3 → testar de forma independente → execução funcional real habilitada (introduz a Provider Abstraction do executor).
5. US4 → testar de forma independente → evidências e histórico completos.
6. US5 → pode entrar em qualquer ponto após o Foundational.
7. Polish → cobertura de regressão e documentação.

### Parallel Team Strategy

Com múltiplos desenvolvedores, após o Foundational:

- Desenvolvedor A: US1 (MVP).
- Desenvolvedor B: US2 (Environment Guard, independente de US1).
- Desenvolvedor C: US5 (configuração, independente de tudo).
- US3 e US4 entram depois, em sequência, pois dependem de US1/US2 e US3 respectivamente.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência bloqueante.
- `[Story]` mapeia a task à User Story correspondente da spec, para rastreabilidade.
- User Story 2 (Environment Guard) é P1 na spec apesar do documento técnico de origem só posicioná-la na "Fase 4" — a spec prioriza por valor testável independentemente (o guard é validável sozinho, por comparação determinística de URL, antes de qualquer executor real existir).
- A Provider Abstraction do executor de testes (`TestExecutorProvider`/`TEST_EXECUTOR_PROVIDER`) foi movida do Foundational (Phase 2) para dentro de US3 (Phase 5, T021/T022/T027): nenhuma história antes de US3 a consome, e sua implementação concreta só passa a existir ali — mantê-la no Foundational criava uma dependência "fundacional" vazia, que travava o registro de `useFactory` sem nenhum provider real ainda para injetar.
- FR-016 ("execução automática futura não pode avançar sozinha para produção — aprovação humana obrigatória") não tem task própria nesta rodada: hoje é satisfeita porque nenhum gatilho automático existe ainda (US5 só guarda a configuração, T036-T038). Quando uma Fase futura implementar o gatilho automático, esse invariante precisa ganhar uma task/teste explícito nesse momento.
- Fases 2-6 do documento técnico de origem (execução real via API/Browser Test Runner completo, dashboard/métricas) estão cobertas pelas User Stories 3-5 nesta lista — não há trabalho documentado em `research.md`/`data-model.md` que tenha ficado de fora do `tasks.md`.
