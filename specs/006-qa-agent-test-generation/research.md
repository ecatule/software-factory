# Research: Agente QA, Geração de Testes e Validação Funcional

## 1. Jest, não Vitest

**Decision**: usar Jest para qualquer teste automatizado desta feature dentro da própria plataforma (`apps/api`).

**Rationale**: o documento técnico de origem (`documentos iniciais/PLAN — Agente QA...md`, §3) recomenda Vitest, mas `apps/api/package.json` já declara `"jest": "^29.7.0"` e é o que roda hoje no CI (`.github/workflows/ci.yml`, step "Test": `pnpm -r test`). Introduzir uma segunda ferramenta de teste unicamente para este recurso violaria a Constituição IV ("Duplicated code MUST be avoided in favor of shared, reusable implementations").

**Alternatives considered**: Vitest (rejeitado — duplicaria ferramenta já estabelecida sem ganho concreto pra esta feature).

## 2. Playwright é dependência nova, mas fora do escopo desta rodada

**Decision**: não adicionar Playwright agora. Fica reservado para a Fase 3 (Browser Test Runner) do documento de origem, quando `/speckit-plan`/`/speckit-tasks` forem rodados para essa fase especificamente.

**Rationale**: confirmado por busca em todo o monorepo — nenhum `package.json` declara `playwright` hoje. A Fase 1 (geração de Test Cases, sem execução) não precisa de nenhum executor de browser.

**Alternatives considered**: adicionar já para "adiantar" a Fase 3 — rejeitado, aumenta a superfície da mudança atual sem uso imediato (nenhum Test Case gerado na Fase 1 é executado).

## 3. Agente QA = novo `Agent.type = "qa"`, mesmo pipeline existente

**Decision**: o Agente QA não é um serviço/worker separado — é um novo valor de `Agent.type` (`"qa"`), processado dentro do `ExecutionsProcessor` já existente (`apps/api/src/modules/executions/executions.processor.ts`), no mesmo padrão dos branches já existentes `if (execution.agent.type === "developer")` / `"specification_copilot"`.

**Rationale**: `Agent.type` já é `String` livre no schema (sem enum Prisma) — extensão sem migração de schema, exatamente o mecanismo que a Constituição III já prevê para crescimento do sistema ("new agent types... without modifying existing components").

**Alternatives considered**: um módulo/fila BullMQ totalmente separado para QA — rejeitado nesta fase: adicionaria orquestração entre duas filas (Developer Agent → sinalizar → fila de QA → sinalizar de volta) para um passo que, na prática, precisa do mesmo workspace/clone já aberto pelo Developer Agent, no mesmo momento.

## 4. Posição no pipeline: entre `implement` e `commit`, na MESMA `AgentExecution`

**Decision**: a geração de QA roda como um novo `pipelineStage` (`"qa-generation"` ou similar) dentro da mesma execução do tipo `"developer"`, logo após `implement` e antes de `commit` — não uma segunda `AgentExecution`.

**Rationale**: é literalmente onde o documento de origem posiciona "QA Test Generation" no pipeline (§13, etapa 3, antes de Commit). O workspace/clone já está aberto e com o diff da implementação disponível nesse ponto exato — reabrir uma segunda execução exigiria re-clonar ou passar estado entre execuções, sem necessidade.

**Alternatives considered**: `AgentExecution` separada, disparada por evento após o `commit` da primeira — rejeitado, mais complexo e o documento de origem explicitamente quer QA **antes** do Commit (bloqueando-o em caso de falha genuína, spec FR-003).

## 5. Environment Guard reaproveita `project-environments/*.json`

**Decision**: em vez de um mecanismo novo (`ALLOWED_TEST_ENVIRONMENTS` como variável de ambiente separada, per documento de origem §11), o Environment Guard lê um novo bloco `homologationEnvironment: { applicationUrl, apiUrl }` no MESMO arquivo `project-environments/<projectId>.json` já usado por `production-reference.guard.ts` para sanitização/bloqueio de referências de produção.

**Rationale**: esse arquivo já é o mecanismo estabelecido nesta plataforma para "configuração de ambiente por projeto, nunca em Postgres, nunca acessível via API" (ver `apps/api/src/modules/executions/project-environment-config.ts`) — um projeto já tem `productionMarkers`/`excludedFiles` etc. ali. Adicionar mais um bloco no mesmo arquivo, em vez de um mecanismo paralelo, é consistente com o princípio de simplicidade da Constituição e evita ter duas fontes de verdade sobre "o que é homologação para este projeto".

**Alternatives considered**: variável de ambiente `ALLOWED_TEST_ENVIRONMENTS` global (per documento de origem) — rejeitado: essa plataforma já tem um projeto multi-cliente, cada um com sua própria URL de homologação (ex.: `stage-corpesaude.vexur.com.br`) — uma única variável global não comporta isso; precisa ser por Projeto, mesmo argumento já usado para `requiredTestSuites`/`qaAutoExecutionEnabled`.

## 6. `TEST_EXECUTION_ENABLED` é por Projeto: `Project.qaAutoExecutionEnabled`

**Decision**: novo campo `Boolean @default(false)` em `Project`, não uma variável de ambiente global.

**Rationale**: resolvido explicitamente na Clarification #2 da spec — mesmo nível de `Project.requiredTestSuites`, já que projetos/clientes diferentes podem querer habilitar isso em momentos diferentes.

**Alternatives considered**: variável de ambiente global (per documento de origem) — rejeitada pela mesma razão do item 5 (plataforma multi-cliente).

## 7. Estados de demanda: extensão do array de referência, sem migração

**Decision**: os novos estados do documento de origem (`IMPLEMENTED`, `TESTS_GENERATED`, `PR_CREATED`, `PR_APPROVED`, `GMUD_CREATED`, `DEPLOYED_HOMOLOGATION`, `READY_FOR_FUNCTIONAL_TEST`, `FUNCTIONAL_TESTING`, `FUNCTIONAL_TEST_PASSED`, `FUNCTIONAL_TEST_FAILED`, `READY_FOR_PRODUCTION`) entram como valores adicionais no array `WORKFLOW_STAGES` (`apps/api/prisma/seed.ts`), sem migração de schema.

**Rationale**: `Demand.status` já é `String` livre no Prisma (confirmado por leitura do schema) — `WORKFLOW_STAGES` é só uma lista de referência semeada, não uma constraint de banco de dados.

**Alternatives considered**: enum Prisma dedicado — rejeitado, quebraria o padrão já estabelecido (todo o resto do workflow de `Demand.status` já usa string livre) e exigiria migração desnecessária.

## 8. Permissões novas: `QA_READ` e `QA_EXECUTE`

**Decision**: duas permissões novas no catálogo (`apps/api/prisma/seed.ts`), seguindo o padrão já estabelecido de uma permissão por tipo de recurso (ex.: `ERROR_LOG_READ` separado de `AUDIT_READ`).

**Rationale**: `QA_READ` cobre a consulta de Test Cases/execuções (baixo risco); `QA_EXECUTE` cobre disparar execução real contra homologação (resolvido na Clarification #1 — ação que atinge um ambiente real merece controle de acesso próprio, não reaproveitar `AGENT_EXECUTE`).

**Alternatives considered**: reaproveitar `AGENT_EXECUTE` — rejeitado na clarificação da spec (mistura "disparar geração de código" com "disparar execução contra ambiente real").
