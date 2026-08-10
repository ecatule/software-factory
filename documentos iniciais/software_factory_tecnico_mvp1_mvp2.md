# Software Factory — Especificação Técnica
## MVP 1 e MVP 2 — React + Node.js + TypeScript + PostgreSQL

## 1. Objetivo técnico

Implementar uma plataforma extensível de Software Factory baseada em monorepo, React, Node.js, TypeScript e PostgreSQL.

A aplicação deve orquestrar demandas, especificações, versões, agentes, LLMs, SPEC Kit, repositórios Git e execuções de desenvolvimento.

A arquitetura deve ser desacoplada dos fornecedores externos:

- Demand Source: inicialmente Monday
- Git Provider: inicialmente GitHub
- LLM Provider: inicialmente ChatGPT
- SDD Engine: SPEC Kit

Cada integração deve ser substituível por outra implementação sem alteração do domínio/core.

## 2. Stack obrigatória

### Frontend

- React
- TypeScript

### Backend

- Node.js
- TypeScript
- REST API
- OpenAPI/Swagger

### Dados

- PostgreSQL

### Complementares

- Redis para cache, rate limit e filas leves
- MinIO/S3 para arquivos
- OpenSearch para busca/logs quando aplicável
- Docker desde o início
- Preparado para Kubernetes

## 3. Princípios arquiteturais

- Monorepo
- Backend como fonte da verdade
- API REST
- Baixo acoplamento
- Alta coesão
- Interfaces para integrações externas
- Domain-Driven Design recomendado
- Soft delete obrigatório
- Logs obrigatórios
- Auditoria obrigatória
- Configuração por ambiente
- Nenhum segredo no código
- Idempotência para operações externas críticas
- Observabilidade desde o início

## 4. Estrutura sugerida do monorepo

```text
/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── contracts/
│   ├── integrations/
│   └── shared/
├── specs/
├── docs/
├── docker/
├── scripts/
└── package.json
```

A estrutura final pode ser adaptada à implementação escolhida, mas deve preservar separação entre domínio, aplicação e infraestrutura.

## 5. Arquitetura em camadas

### Domain

Entidades, value objects, regras de domínio e contratos.

### Application

Casos de uso, orquestração, DTOs e portas/interfaces.

### Infrastructure

Persistência, mensageria, arquivos, logs e integrações externas.

### API

Controllers, middleware, autenticação, autorização, OpenAPI e tratamento de erros.

### Frontend

Pages, components, hooks, services, state management e integração REST.

## 6. Principais módulos

```text
Demand Management
Client Management
Project Management
Technology Catalog
Repository Management
Specification Management
Specification Versioning
Increment Management
Artifact Management
AI Provider Management
Agent Management
Agent Execution
SPEC Kit Integration
Task Management
Git Integration
Test Execution
Workflow Management
Audit
Observability
```

## 7. Modelo de domínio

Entidades principais:

- Client
- Project
- Technology
- ProjectTechnology
- Repository
- Demand
- DemandIncrement
- Specification
- SpecificationVersion
- SpecificationArtifact
- Artifact
- Task
- Agent
- AgentExecution
- LLMProvider
- LLMModel
- Workflow
- WorkflowExecution
- GitBranch
- GitCommit
- PullRequest
- TestExecution
- AuditEvent

## 8. Campos obrigatórios de persistência

Todas as tabelas devem possuir:

- `id UUID`
- `st_ativo`
- `created_at`
- `updated_at`
- `deleted_at`
- `created_by`
- `updated_by`
- `version`

Não utilizar delete físico.

## 9. Demand

Campos adicionais sugeridos:

- `external_ticket_id`
- `title`
- `description`
- `type`
- `priority`
- `status`
- `client_id`
- `project_id`
- `current_increment_id`
- `due_at`

Deve existir identificador interno independente do ticket do Monday.

## 10. Demand Increment

Campos:

- `id`
- `demand_id`
- `number`
- `title`
- `description`
- `status`
- `base_specification_version_id`
- `created_by`
- timestamps

Regra: um incremento representa uma evolução independente dentro da mesma demanda.

## 11. Technology

Campos:

- `name`
- `category`
- `version`
- `description`
- `st_ativo`

Relacionamento:

`Project N:N Technology`

A seleção de tecnologias do projeto deve ser automaticamente incorporada ao contexto enviado à LLM.

## 12. Repository

Campos:

- `name`
- `provider`
- `external_id`
- `url`
- `default_branch`
- `production_branch`
- `homologation_branch`
- `project_id`
- `status`

Não acoplar o domínio ao GitHub.

Criar interface conceitual:

```text
GitProvider
├── getRepository()
├── createBranch()
├── getBranch()
├── commit()
├── push()
├── createPullRequest()
├── getPullRequest()
└── getPullRequestChecks()
```

Implementação inicial:

`GitHubProvider`

## 13. Artifact

Campos:

- `type`
- `name`
- `description`
- `repository_id`
- `path`
- `technology_id`
- `project_id`
- `demand_id`
- `status`

Tipos extensíveis:

- SCREEN
- API
- COMPONENT
- SERVICE
- DATABASE
- QUERY
- JOB
- CONFIGURATION
- OTHER

Artefatos são referências/metadados. Não duplicar repositórios Git dentro da estrutura de especificações.

## 14. Specification

Separar:

- Specification
- SpecificationVersion

`Specification` representa o documento lógico.

`SpecificationVersion` representa uma versão imutável.

Campos da versão:

- `specification_id`
- `version_number`
- `increment_id`
- `type`
- `content`
- `file_path`
- `source`
- `llm_provider_id`
- `llm_model`
- `status`
- `approved_by`
- `approved_at`
- `change_summary`

Tipos:

- `SPECIFY`
- `PLAN`

Status:

- DRAFT
- GENERATED
- REVIEW
- APPROVED
- REJECTED
- SUPERSEDED

## 15. Armazenamento dos Markdown

O conteúdo deve possuir persistência estruturada no PostgreSQL e arquivo físico/objeto quando necessário.

Formato:

```text
demandas/
  {demand-id}/
    especificacoes/
      incremento-01/
        v1/
          specify.md
          plan.md
```

MinIO/S3 pode armazenar os arquivos.

PostgreSQL mantém metadados, relacionamento, versão, status e auditoria.

## 16. Specification Context

Antes de chamar a LLM, o backend deve montar um contexto único contendo:

```text
Demand
Client
Project
Technologies
Repositories
Known Artifacts
Current Increment
Previous Approved Specification
Previous Plan
Human Business Input
Human Technical Input
Relevant History
```

Esse contexto deve ser versionável/auditável.

## 17. LLM Provider

Não acoplar a aplicação diretamente ao ChatGPT.

Criar abstração:

```text
LLMProvider
├── generate()
├── continueConversation()
├── validateResponse()
└── getCapabilities()
```

Implementação inicial:

`OpenAIProvider`

O sistema deve permitir futuramente:

- Claude
- Gemini
- Azure OpenAI
- Outros

Configurações sensíveis devem vir de environment/secret manager.

## 18. Assistente de especificação

Fluxo técnico:

```text
Frontend
   ↓
POST /demands/{id}/specification/sessions
   ↓
Backend monta SpecificationContext
   ↓
LLM Provider
   ↓
Resposta estruturada
   ↓
Backend valida
   ↓
Cria Draft Specification Version
   ↓
Frontend apresenta revisão
```

A IA não pode alterar uma versão aprovada diretamente.

## 19. Estrutura da resposta da LLM

Preferir resposta estruturada, por exemplo:

```json
{
  "summary": "...",
  "businessRequirements": [],
  "businessRules": [],
  "acceptanceCriteria": [],
  "flows": [],
  "technicalRequirements": [],
  "identifiedArtifacts": [],
  "suggestedArtifacts": [],
  "risks": [],
  "questions": [],
  "specifyMarkdown": "...",
  "planMarkdown": "...",
  "changeSummary": []
}
```

O backend deve validar o contrato antes de persistir.

## 20. Conversação de revisão

A interação com IA deve permitir:

- Solicitar complemento
- Corrigir informação
- Pedir revisão
- Pedir identificação de lacunas
- Aceitar sugestão
- Rejeitar sugestão

Cada interação deve possuir `AgentExecution`/`LLMExecution` rastreável.

Não substituir silenciosamente o conteúdo humano.

## 21. Incrementos

Ao criar novo incremento:

```text
Current Approved Specification
+
Current Approved Plan
+
New Human Input
+
Project Context
```

gera novo draft.

O sistema deve calcular/registrar:

- artefatos adicionados
- artefatos removidos
- artefatos alterados
- requisitos adicionados
- regras alteradas
- APIs impactadas
- dados impactados
- testes adicionais

## 22. Frontend — Dashboard

Implementar dashboard com cards e gráficos para:

- demandas por status
- demandas por cliente
- demandas bloqueadas
- PRs
- testes
- agentes
- tempo médio

Todos os indicadores devem consumir API.

## 23. Frontend — Demand List

Tabela paginada com filtros.

Colunas mínimas:

- ticket
- título
- cliente
- projeto
- tipo
- prioridade
- status
- incremento
- agente
- PR
- updated_at

## 24. Frontend — Demand Cockpit

Componente central:

```text
DemandCockpit
├── Header
├── WorkflowStepper
├── SummaryTab
├── SpecificationTab
├── ArtifactsTab
├── TasksTab
├── DevelopmentTab
├── TestsTab
├── GitTab
├── TimelineTab
└── AuditTab
```

O WorkflowStepper deve refletir o estado persistido no backend.

## 25. Tela de especificação

Componentes sugeridos:

```text
SpecificationWorkspace
├── BusinessInputEditor
├── TechnicalInputEditor
├── TechnologySelector
├── ArtifactSelector
├── AIConversationPanel
├── SpecificationPreview
├── VersionHistory
├── DiffViewer
└── ApprovalPanel
```

O editor deve suportar Markdown.

A tela deve permitir visualizar lado a lado:

- entrada humana
- sugestão da IA
- documento gerado

## 26. Versionamento e diff

A API deve fornecer:

```text
GET /demands/{id}/specifications
GET /specifications/{id}/versions
GET /specifications/{id}/versions/{version}
GET /specifications/{id}/diff?from=x&to=y
POST /specifications/{id}/versions
POST /specification-versions/{id}/approve
```

Versões aprovadas são imutáveis.

## 27. APIs principais — MVP 1

```text
GET/POST /clients
GET/POST /projects
GET/POST /technologies
GET/POST /repositories

GET/POST /demands
GET/PATCH /demands/{id}
POST /demands/{id}/increments

GET /demands/{id}/context
GET/POST /demands/{id}/artifacts

POST /demands/{id}/specification/sessions
POST /specification-sessions/{id}/messages
GET /specifications/{id}/versions
POST /specification-versions/{id}/approve

GET /demands/{id}/timeline
GET /demands/{id}/audit
```

## 28. Workflow engine

Não implementar workflow como lógica espalhada pelos controllers.

Criar serviço de domínio/aplicação:

```text
WorkflowService
```

Responsável por:

- estágio atual
- transições válidas
- gates
- bloqueios
- aprovação
- histórico

Exemplo:

```text
SPECIFICATION
   ↓
SPECIFICATION_REVIEW
   ↓
SPECIFICATION_APPROVED
```

Somente transições válidas devem ser aceitas.

## 29. MVP 2 — SPEC Kit

Criar integração desacoplada:

```text
SpecificationEngine
```

Implementação inicial:

`SpecKitEngine`

Operações:

```text
specify()
clarify()
plan()
generateTasks()
```

Os comandos devem ser executáveis por processo controlado pelo backend/worker e possuir logs.

O backend deve armazenar:

- comando
- versão
- entrada
- saída
- duração
- exit code
- erro
- arquivos gerados

## 30. Workspace

Cada demanda/incremento deve possuir workspace lógico.

Não armazenar o repositório definitivo dentro da pasta de documentação.

O workspace deve referenciar:

- Repository
- Branch
- Commit base
- Increment
- Artefatos

## 31. Branch

A nomenclatura deve ser configurável.

Sugestão:

```text
{type}/{client-slug}/{ticket}-{slug}
```

Exemplos:

```text
bug/cliente-a/4587-cancelamento-cobranca
feature/cliente-b/4601-nova-tela-clientes
```

A regra deve ser configurável por projeto.

## 32. Developer Agent

Entrada mínima:

```text
Approved specify.md
Approved plan.md
Tasks
Project
Technologies
Repositories
Artifacts
Current branch
Relevant history
```

Saída esperada:

```text
Code changes
Changed files
Tests created/changed
Commit proposal
Execution logs
Issues/blockers
```

O Developer Agent não deve operar diretamente sobre produção.

## 33. Testes

MVP 2 deve executar testes automatizados configurados pelo projeto.

Gates mínimos configuráveis:

- Unit Tests
- Integration Tests
- Lint
- Build

Registrar:

- comando
- resultado
- duração
- stdout/stderr
- coverage quando disponível
- commit
- execução do agente

Status:

- PASSED
- FAILED
- ERROR
- SKIPPED

## 34. Git flow

Após sucesso dos testes:

```text
Developer Agent
      ↓
Test Gate
      ↓
Commit
      ↓
Push
      ↓
Create Pull Request
```

Criar PR automaticamente somente após os gates configurados.

Registrar:

- repository
- branch
- base branch
- commit
- PR number
- URL
- status
- checks
- approvals

## 35. Segurança

Implementar:

- OAuth2
- OpenID Connect
- JWT
- Refresh Token
- RBAC
- Middleware de autenticação
- Rate limit
- LGPD
- Criptografia
- Auditoria

Permissões devem ser verificadas no backend.

Exemplos:

```text
DEMAND_READ
DEMAND_WRITE
SPECIFICATION_WRITE
SPECIFICATION_APPROVE
AGENT_EXECUTE
GIT_WRITE
PR_CREATE
AUDIT_READ
```

## 36. Logs e auditoria

Separar:

### Log técnico

Execuções, erros, integrações, jobs.

### Auditoria

Quem fez o quê, quando, sobre qual entidade e qual resultado.

Eventos importantes:

- DEMAND_CREATED
- SPECIFICATION_GENERATED
- SPECIFICATION_EDITED
- SPECIFICATION_APPROVED
- INCREMENT_CREATED
- AGENT_STARTED
- AGENT_FINISHED
- GIT_BRANCH_CREATED
- COMMIT_CREATED
- PR_CREATED
- TEST_EXECUTED
- WORKFLOW_TRANSITIONED

## 37. Jobs assíncronos

Operações longas não devem bloquear requests HTTP.

Usar workers/filas para:

- LLM
- SPEC Kit
- Developer Agent
- testes
- Git
- geração de arquivos

Redis pode ser utilizado inicialmente.

## 38. Idempotência

Operações externas críticas devem ser idempotentes:

- criar branch
- commit
- push
- criar PR
- executar integração
- importar demanda

Não criar duplicidades em caso de retry.

## 39. Observabilidade

Registrar:

- correlation_id
- request_id
- demand_id
- increment_id
- agent_execution_id
- provider
- duration
- status
- error

Preparar integração futura com OpenSearch.

## 40. Integração Monday

Criar abstração:

```text
DemandProvider
├── getDemand()
├── listDemands()
├── createDemand()
├── updateDemand()
└── sync()
```

Implementação inicial:

`MondayProvider`

O domínio não deve conhecer estruturas específicas do Monday.

## 41. Integração GitHub

Criar:

```text
GitProvider
```

Implementação:

`GitHubProvider`

O domínio não deve depender de classes específicas do SDK GitHub.

## 42. Estrutura lógica dos arquivos por demanda

```text
demandas/
└── {demand-id}/
    ├── especificacoes/
    │   ├── incremento-01/
    │   │   ├── v1/
    │   │   │   ├── specify.md
    │   │   │   └── plan.md
    │   │   └── current/
    │   └── incremento-02/
    │
    ├── artefatos/
    │   ├── tela-clientes/
    │   └── api-clientes/
    │
    ├── tasks/
    ├── testes/
    └── git/
```

Os repositórios Git permanecem externos.

## 43. Docker

Todos os serviços devem possuir suporte Docker.

Desenvolvimento local deve contemplar, quando aplicável:

```text
web
api
postgres
redis
minio
opensearch
```

Não tornar OpenSearch obrigatório para o funcionamento básico do MVP.

## 44. Kubernetes

Preparar:

- health check
- readiness
- liveness
- configuração externa
- secrets
- stateless API
- workers independentes
- jobs
- escalabilidade horizontal

Não é necessário criar uma operação Kubernetes completa no MVP.

## 45. Critérios de aceite MVP 1

1. Usuário consegue cadastrar cliente.
2. Usuário consegue cadastrar projeto.
3. Usuário consegue cadastrar tecnologias.
4. Usuário consegue associar tecnologias ao projeto.
5. Usuário consegue cadastrar repositórios.
6. Usuário consegue criar/importar demanda.
7. Usuário consegue criar incremento.
8. Usuário consegue informar requisitos de negócio.
9. Usuário consegue informar insumos técnicos.
10. Usuário consegue informar artefatos.
11. Sistema monta contexto.
12. Sistema envia contexto ao LLM configurado.
13. Sistema recebe proposta.
14. Usuário consegue revisar.
15. Usuário consegue editar.
16. Usuário consegue solicitar nova geração.
17. Sistema cria versões.
18. Usuário consegue comparar versões.
19. Usuário consegue aprovar versão.
20. Sistema gera `specify.md`.
21. Sistema gera `plan.md`.
22. Documentos ficam armazenados.
23. Auditoria é registrada.
24. Timeline é atualizada.
25. Usuário consegue criar novo incremento mantendo histórico.

## 46. Critérios de aceite MVP 2

1. Especificação aprovada pode iniciar SDD.
2. `/speckit.specify` pode ser executado.
3. `/speckit.clarify` pode ser executado.
4. `/speckit.plan` pode ser executado.
5. Tasks podem ser armazenadas.
6. Branch pode ser criada automaticamente.
7. Developer Agent recebe contexto aprovado.
8. Developer Agent consegue alterar workspace.
9. Testes automatizados podem ser executados.
10. Falhas são registradas.
11. Sucesso nos gates permite commit.
12. Push pode ser executado.
13. PR pode ser criado automaticamente.
14. Cockpit mostra branch, commits, testes e PR.
15. Todas as operações relevantes possuem auditoria.

## 47. Fora do escopo inicial

- QA Agent autônomo
- Deploy automático em produção
- GMUD automática
- Aprovação automática de produção
- Multi-tenancy
- Marketplace de agentes
- Treinamento/fine-tuning de modelos
- Substituição automática de LLM baseada em custo

Esses recursos devem ser considerados extensões futuras.

## 48. Resultado arquitetural esperado

A solução deve permitir substituir:

```text
Monday → outro DemandProvider
GitHub → outro GitProvider
ChatGPT → Claude/Gemini/outro LLMProvider
SPEC Kit → outro SpecificationEngine
```

sem alteração significativa do domínio.

O Core deve conhecer conceitos de negócio, não fornecedores.

O fluxo principal deve ser:

```text
DEMANDA
   ↓
ESPECIFICAÇÃO HUMANA
   ↓
IA COPILOTO
   ↓
SPECIFY + PLAN
   ↓
APROVAÇÃO HUMANA
   ↓
SPEC KIT
   ↓
TASKS
   ↓
DEVELOPER AGENT
   ↓
TESTES
   ↓
COMMIT
   ↓
PUSH
   ↓
PULL REQUEST
```

Esse fluxo constitui a base técnica da Software Factory orientada a SDD.
