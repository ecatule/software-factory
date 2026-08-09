# AI Software Factory — Technical Implementation Plan

## 1. Objetivo

Implementar a AI Software Factory como um **Monorepo modular**, utilizando:

```text
Frontend
React + TypeScript

Backend
Node.js + TypeScript

Database
PostgreSQL
```

A aplicação deverá integrar Spec Kit, LLMs, Monday e GitHub através de providers substituíveis.

---

# 2. Arquitetura

Utilizar inicialmente:

```text
Modular Monolith
```

dentro de um:

```text
Monorepo
```

Evitar microserviços no MVP.

Arquitetura:

```text
React
   ↓
REST API
   ↓
Application
   ↓
Domain
   ↓
Infrastructure
   ↓
PostgreSQL
```

Integrações externas:

```text
Monday
GitHub
LLMs
Spec Kit
MinIO
Redis
OpenSearch
```

deverão permanecer na camada de infraestrutura.

---

# 3. Estrutura do Monorepo

```text
software-factory/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── contracts/
│   ├── shared/
│   ├── config/
│   └── ui/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── .specify/
│
├── workspace/
│
├── tests/
│
├── docker/
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

# 4. Workspace das Demandas

O diretório:

```text
workspace/
```

será utilizado para armazenar o ambiente de trabalho temporário ou operacional de cada demanda.

Estrutura:

```text
workspace/
└── <ticket>-<slug>/
    │
    ├── spec/
    │
    └── artefatos/
```

Exemplo:

```text
workspace/
└── 4587-correcao-cancelamento/
    │
    ├── spec/
    │   ├── spec.md
    │   ├── plan.md
    │   ├── research.md
    │   ├── checklist.md
    │   ├── tasks.md
    │   └── analysis.md
    │
    └── artefatos/
        ├── Tela-Clientes/
        ├── API-Clientes/
        └── Banco-Clientes/
```

---

# 5. Regra da pasta `spec`

A pasta:

```text
workspace/<demanda>/spec/
```

deverá conter exclusivamente os documentos SDD.

Exemplo:

```text
spec/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklist.md
├── tasks.md
└── analysis.md
```

Nenhum repositório Git deverá ser colocado diretamente nessa pasta.

---

# 6. Regra da pasta `artefatos`

A pasta:

```text
workspace/<demanda>/artefatos/
```

deverá conter os artefatos de código envolvidos na implementação.

Exemplo:

```text
artefatos/
├── Tela-Clientes/
├── API-Clientes/
└── Banco-Clientes/
```

Cada diretório representa um artefato lógico.

---

# 7. Repositório Git dentro do Artefato

O workspace de código do artefato poderá conter o clone do repositório Git necessário para sua implementação.

Exemplo:

```text
workspace/
└── 4587-correcao-cancelamento/
    │
    ├── spec/
    │
    └── artefatos/
        │
        ├── Tela-Clientes/
        │   ├── metadata.yaml
        │   ├── .git/
        │   ├── src/
        │   ├── package.json
        │   └── ...
        │
        └── API-Clientes/
            ├── metadata.yaml
            ├── .git/
            ├── src/
            ├── package.json
            └── ...
```

Entretanto, o sistema deverá evitar clones duplicados quando vários artefatos utilizarem o mesmo repositório.

---

# 8. Artefato x Repositório

Não assumir:

```text
1 Artefato = 1 Repositório
```

O relacionamento correto é:

```text
Artifact N : N Repository
```

Exemplo:

```text
Tela-Clientes ─────┐
                   ├── sistema-cliente
API-Clientes ──────┘
```

Ou:

```text
Tela-Clientes ──── frontend
API-Clientes ───── backend
Banco-Clientes ─── database
```

A modelagem deverá suportar ambos.

---

# 9. Metadata do Artefato

Cada artefato deverá possuir:

```text
metadata.yaml
```

Exemplo:

```yaml
name: Tela-Clientes

type: frontend

technology: React

repository:
  provider: github
  repository: sistema-cliente

path: src/features/clientes

branch: feature/cliente-a/4587-correcao-cancelamento

status: development

files:
  - src/features/clientes/ClienteList.tsx
  - src/features/clientes/ClienteForm.tsx
  - src/features/clientes/ClienteService.ts
```

---

# 10. Modelo de Dados — Artifact

Criar entidade:

```text
Artifact
```

Campos:

```text
id
demand_id
name
type
description
technology
path
repository_id
status
created_at
updated_at
```

Criar:

```text
ArtifactFile
```

Campos:

```text
id
artifact_id
file_path
change_type
status
reason
created_at
updated_at
```

Tipos:

```text
MODIFIED
ADDED
REMOVED
DISCOVERED
```

---

# 11. Workspace Entity

Criar entidade:

```text
DemandWorkspace
```

Campos:

```text
id
demand_id
path
status
created_at
updated_at
```

O workspace deverá possuir relacionamento:

```text
Demand
   ↓
DemandWorkspace
   ↓
Artifacts
```

---

# 12. Rastreabilidade

Implementar:

```text
Demand
 ↓
Specification
 ↓
Artifact
 ↓
Task
 ↓
ArtifactFile
 ↓
Commit
 ↓
TestExecution
 ↓
PullRequest
```

A API deverá permitir recuperar toda essa cadeia.

---

# 13. Módulos do Backend

Criar módulos:

```text
Identity
Clients
Projects
Demands
Workspaces
Specifications
Artifacts
Agents
Executions
Workflows
Providers
Repositories
Branches
Commits
Tests
PullRequests
Audit
```

---

# 14. Entidades principais

Criar inicialmente:

```text
User
Role
Permission

Client
Project

Demand
DemandStatus

DemandWorkspace

Workflow
WorkflowStage
WorkflowTransition

Agent
AgentExecution

Provider
ProviderConfiguration

Specification
SpecificationVersion

Artifact
ArtifactFile
ArtifactVersion

Repository
Branch
Commit
PullRequest

TestExecution
TestResult

AuditLog
```

---

# 15. Campos obrigatórios

Todas as tabelas deverão possuir:

```text
id UUID
st_ativo
created_at
updated_at
deleted_at
created_by
updated_by
version
```

Soft delete obrigatório.

---

# 16. Versionamento

Utilizar `version` para controle de concorrência.

Aplicar optimistic locking em:

- demandas;
- especificações;
- artefatos;
- configurações;
- workflows.

---

# 17. Demand Provider

Criar:

```typescript
interface DemandProvider {
  getDemand(id: string): Promise<Demand>;
  listDemands(filter: DemandFilter): Promise<Demand[]>;
  updateDemandStatus(id: string, status: string): Promise<void>;
}
```

Implementação:

```text
MondayDemandProvider
```

---

# 18. LLM Provider

Criar:

```typescript
interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;

  generateStructured<T>(
    request: LLMRequest
  ): Promise<T>;
}
```

Implementações:

```text
ChatGPTProvider
ClaudeProvider
```

---

# 19. SDD Provider

Criar:

```typescript
interface SDDProvider {
  specify(input: SDDInput): Promise<ArtifactResult>;
  clarify(input: SDDInput): Promise<ArtifactResult>;
  plan(input: SDDInput): Promise<ArtifactResult>;
  checklist(input: SDDInput): Promise<ArtifactResult>;
  tasks(input: SDDInput): Promise<ArtifactResult>;
  analyze(input: SDDInput): Promise<ArtifactResult>;
  implement(input: SDDInput): Promise<ImplementationResult>;
}
```

Implementação inicial:

```text
SpecKitProvider
```

---

# 20. Spec Kit

Integrar o Spec Kit através do `SpecKitProvider`.

Fluxo:

```text
specify
 ↓
clarify
 ↓
plan
 ↓
checklist
 ↓
tasks
 ↓
analyze
 ↓
implement
```

A integração deverá:

1. criar workspace da demanda;
2. preparar contexto;
3. executar comando;
4. capturar saída;
5. identificar artefatos;
6. persistir especificações;
7. versionar documentos;
8. registrar execução;
9. atualizar workflow.

---

# 21. Specification Agent

Criar:

```text
SpecificationAgent
```

Entrada:

```text
Demand
Client
Project
Business Context
Existing Documentation
Project Knowledge
```

Saída:

```text
spec.md
plan.md
research.md
data-model.md
checklist.md
tasks.md
analysis.md
Artifacts
Acceptance Criteria
Risks
Dependencies
```

---

# 22. Identificação de Artefatos

O Specification Agent deverá identificar:

```text
Frontend
Backend
Database
Tests
Configurations
Integrations
Reports
Jobs
```

Exemplo:

```yaml
artifacts:
  - name: Tela-Clientes
    type: frontend
    technology: React

  - name: API-Clientes
    type: backend
    technology: Node.js

  - name: Banco-Clientes
    type: database
    technology: PostgreSQL
```

Após a identificação:

```text
Artifact
   ↓
Workspace
   ↓
Repository
   ↓
Branch
```

---

# 23. Criação do Workspace

Quando o planejamento for aprovado:

```text
workspace/<ticket>-<slug>/
```

deverá ser criado.

Estrutura inicial:

```text
workspace/
└── 4587-correcao-cancelamento/
    ├── spec/
    └── artefatos/
```

A pasta `artefatos` deverá ser criada conforme os artefatos identificados.

---

# 24. Developer Agent

Criar:

```text
DeveloperAgent
```

Entrada:

```text
Demand
Workspace
spec/
Artifacts
ArtifactFiles
Repository
Branch
ProjectRules
Tasks
```

O agente deverá:

1. ler a especificação;
2. ler o plano;
3. ler as tasks;
4. analisar os artefatos;
5. acessar o código;
6. implementar;
7. executar testes;
8. corrigir falhas;
9. atualizar arquivos impactados;
10. preparar commit;
11. criar Pull Request.

---

# 25. Descoberta de Arquivos

Antes da implementação o Developer Agent deverá:

1. analisar o repositório;
2. localizar o artefato;
3. localizar arquivos previstos;
4. confirmar estrutura;
5. identificar dependências;
6. atualizar `ArtifactFile`.

Se descobrir arquivo fora do planejamento:

```text
DISCOVERED
```

deverá ser registrado com justificativa.

---

# 26. Repository Provider

Criar:

```typescript
interface CodeRepositoryProvider {
  getRepository(): Promise<Repository>;
  cloneRepository(): Promise<void>;
  createBranch(): Promise<Branch>;
  getFile(): Promise<File>;
  searchCode(): Promise<File[]>;
  commit(): Promise<Commit>;
  push(): Promise<void>;
  createPullRequest(): Promise<PullRequest>;
  getPullRequest(): Promise<PullRequest>;
  getChecks(): Promise<Check[]>;
}
```

Implementação inicial:

```text
GitHubRepositoryProvider
```

---

# 27. Branch Policy

Criar:

```text
BranchNamingPolicy
```

Formato:

```text
<type>/<client>/<ticket>-<slug>
```

Exemplos:

```text
bug/cliente-a/4587-correcao-cancelamento

feature/cliente-a/4621-novo-relatorio

improvement/cliente-b/4701-dashboard
```

---

# 28. Branch por Demanda

A branch deverá ser criada antes do desenvolvimento.

Exemplo:

```text
Demand #4587
        ↓
Branch
bug/cliente-a/4587-correcao-cancelamento
```

Quando vários artefatos utilizarem o mesmo repositório:

```text
Tela-Clientes ─────┐
                    ├── mesma branch
API-Clientes ──────┘
```

Quando utilizarem repositórios diferentes:

```text
Tela-Clientes ──── Branch A
API-Clientes ───── Branch B
```

A arquitetura deverá suportar ambos os casos.

---

# 29. Test Runner

Criar:

```text
TestRunner
```

Os comandos serão configuráveis por projeto.

Exemplo:

```text
npm test
npm run lint
npm run build
```

---

# 30. Test Execution

Criar:

```text
TestExecution
TestResult
```

Registrar:

```text
command
status
started_at
finished_at
duration
passed
failed
skipped
coverage
output
error
```

---

# 31. Test Gate

Implementar:

```text
DEVELOPMENT
    ↓
TESTING
    ↓
TEST GATE
    │
    ├── FAIL → DEVELOPMENT_FAILED
    │
    └── PASS
          ↓
        COMMIT
```

Nenhum commit automático deverá ocorrer enquanto os testes obrigatórios estiverem falhando.

---

# 32. Commit

Após o Test Gate:

```text
Commit
 ↓
Push
```

O commit deverá estar relacionado a:

```text
Demand
Artifact
Task
TestExecution
AgentExecution
```

---

# 33. Pull Request

Após o Push:

```text
Create Pull Request
```

Descrição automática:

```text
## Demanda

#4587

## Resumo

...

## Artefatos

- Tela-Clientes
- API-Clientes

## Arquivos alterados

...

## Testes

...

## Riscos

...

## Especificação

...
```

---

# 34. Agent Execution

Criar:

```text
AgentExecution
```

Campos:

```text
id
agent_id
demand_id
provider_id
model
status
started_at
finished_at
input
output
error
```

Estados:

```text
QUEUED
RUNNING
COMPLETED
FAILED
CANCELLED
```

---

# 35. Execução Assíncrona

Execuções de agentes deverão ser assíncronas.

Fluxo:

```text
API
 ↓
Queue
 ↓
Worker
 ↓
Agent
 ↓
Provider
 ↓
Workspace
```

Redis poderá ser utilizado como fila.

---

# 36. Frontend

Criar:

```text
Dashboard
Clients
Projects
Demands
DemandCockpit
Workspaces
Artifacts
Specifications
Agents
Executions
Tests
Repositories
Branches
Commits
PullRequests
Audit
Settings
```

---

# 37. Demand Cockpit

A tela da demanda deverá apresentar:

```text
Informações
Workflow
Workspace
Artefatos
Especificações
Tasks
Executions
Development
Tests
Git
Pull Request
Timeline
Audit
```

---

# 38. Tela de Workspace

Deverá mostrar:

```text
Workspace
 ├── spec
 │    ├── spec.md
 │    ├── plan.md
 │    ├── tasks.md
 │    └── ...
 │
 └── artefatos
      ├── Tela-Clientes
      ├── API-Clientes
      └── Banco-Clientes
```

O usuário deverá conseguir navegar pelo conteúdo autorizado.

---

# 39. Tela de Artefatos

Exibir:

```text
Nome
Tipo
Tecnologia
Repositório
Branch
Caminho
Arquivos
Tasks
Status
Agent
Execution
Commits
Tests
PR
```

---

# 40. Tela de Especificações

Funcionalidades:

```text
Markdown Editor
Preview
Version History
Diff
Restore
Metadata
```

---

# 41. Tela de Testes

Exibir:

```text
Test Suite
Command
Status
Passed
Failed
Skipped
Duration
Coverage
Logs
```

---

# 42. Tela de Git

Exibir:

```text
Repository
Branch
Commits
Pull Request
Checks
```

---

# 43. Timeline

Registrar eventos:

```text
DEMAND_CREATED
WORKSPACE_CREATED
SPEC_STARTED
SPEC_CREATED
SPEC_UPDATED
ARTIFACT_CREATED
ARTIFACT_UPDATED
TASK_CREATED
ANALYSIS_COMPLETED
REPOSITORY_CLONED
BRANCH_CREATED
DEVELOPMENT_STARTED
FILE_CHANGED
TEST_STARTED
TEST_COMPLETED
COMMIT_CREATED
PUSH_COMPLETED
PR_CREATED
```

---

# 44. API REST

Endpoints principais:

```text
/api/v1/clients
/api/v1/projects
/api/v1/demands
/api/v1/workspaces
/api/v1/artifacts
/api/v1/specifications
/api/v1/agents
/api/v1/executions
/api/v1/workflows
/api/v1/providers
/api/v1/repositories
/api/v1/branches
/api/v1/commits
/api/v1/tests
/api/v1/pull-requests
/api/v1/audits
```

---

# 45. Demand API

```text
GET    /api/v1/demands
POST   /api/v1/demands
GET    /api/v1/demands/:id
PATCH  /api/v1/demands/:id

GET    /api/v1/demands/:id/workspace
GET    /api/v1/demands/:id/workflow
GET    /api/v1/demands/:id/timeline
GET    /api/v1/demands/:id/artifacts
GET    /api/v1/demands/:id/specifications
```

---

# 46. Workspace API

```text
GET    /api/v1/workspaces/:id
GET    /api/v1/workspaces/:id/tree
GET    /api/v1/workspaces/:id/files
```

O acesso deverá respeitar permissões.

---

# 47. Artifact API

```text
GET  /api/v1/demands/:id/artifacts
POST /api/v1/demands/:id/artifacts

GET  /api/v1/artifacts/:id
PATCH /api/v1/artifacts/:id

GET  /api/v1/artifacts/:id/files
GET  /api/v1/artifacts/:id/versions
```

---

# 48. Execution API

```text
GET  /api/v1/executions
GET  /api/v1/executions/:id
POST /api/v1/executions
POST /api/v1/executions/:id/retry
POST /api/v1/executions/:id/cancel
```

---

# 49. Segurança

Implementar:

```text
OAuth2
OpenID Connect
JWT
Refresh Token
RBAC
Rate Limit
Middleware
LGPD
Audit
Encryption
```

Nenhum segredo poderá ser armazenado no código.

---

# 50. Configuração

Utilizar variáveis de ambiente.

Exemplo:

```text
DATABASE_URL
REDIS_URL

MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY

MONDAY_API_URL
MONDAY_API_TOKEN

GITHUB_API_URL
GITHUB_TOKEN

LLM_PROVIDER

OPENAI_API_KEY
ANTHROPIC_API_KEY
```

Criar:

```text
.env.example
```

---

# 51. Docker

Criar:

```text
docker-compose.yml
```

Serviços:

```text
web
api
postgres
redis
minio
```

OpenSearch deverá ficar preparado para inclusão futura.

---

# 52. Auditoria

Registrar:

```text
user
action
entity
entity_id
before
after
timestamp
correlation_id
```

Todas as operações críticas deverão gerar auditoria.

---

# 53. Observabilidade

Toda requisição deverá possuir:

```text
request_id
correlation_id
```

Toda execução de agente:

```text
execution_id
```

Logs deverão permitir reconstruir o ciclo da demanda.

---

# 54. MVP 1 — Sequência

Implementar:

```text
1. Monorepo
2. Docker
3. React
4. Node.js
5. TypeScript
6. PostgreSQL
7. REST/OpenAPI
8. Authentication
9. RBAC
10. Clients
11. Projects
12. Demands
13. Workspaces
14. Workflow
15. Providers
16. Agents
17. AgentExecution
18. Specifications
19. Artifacts
20. ArtifactFile
21. SpecKitProvider
22. Specification Agent
23. Spec Kit
24. Dashboard
25. Demand Cockpit
26. Workspace UI
27. Artifact UI
28. Specification UI
29. Timeline
30. Audit
```

---

# 55. MVP 1 — Critério de Aceite

Deverá ser possível:

```text
Criar Cliente
   ↓
Criar Projeto
   ↓
Cadastrar Provider
   ↓
Cadastrar Agent
   ↓
Criar Demanda
   ↓
Criar Workspace
   ↓
Executar Specify
   ↓
Executar Clarify
   ↓
Executar Plan
   ↓
Identificar Artefatos
   ↓
Criar estrutura de artefatos
   ↓
Executar Tasks
   ↓
Executar Analyze
   ↓
Visualizar tudo no Cockpit
```

Também deverá ser possível:

```text
Editar spec.md
   ↓
Salvar nova versão
   ↓
Visualizar histórico
   ↓
Comparar versões
   ↓
Restaurar versão
```

---

# 56. MVP 2 — Sequência

Implementar:

```text
1. Repository
2. GitHub Provider
3. Repository Workspace
4. Branch Policy
5. Branch
6. ArtifactFile discovery
7. Developer Agent
8. Implement
9. Test Runner
10. Test Execution
11. Test Gate
12. Commit
13. Push
14. Pull Request
15. PR monitoring
16. Git UI
17. Test UI
18. End-to-End workflow
```

---

# 57. MVP 2 — Critério de Aceite

Uma demanda deverá conseguir executar:

```text
Specification
   ↓
Plan
   ↓
Artifacts
   ↓
Workspace
   ↓
Tasks
   ↓
Analysis
   ↓
Repository
   ↓
Branch
   ↓
Developer Agent
   ↓
Implementation
   ↓
Tests
   ↓
Test Gate
   ↓
Commit
   ↓
Push
   ↓
Pull Request
```

A interface deverá apresentar o resultado completo.

---

# 58. Definition of Done

Uma funcionalidade somente será considerada concluída quando:

```text
[ ] Código implementado
[ ] Testes unitários
[ ] Testes de integração quando aplicável
[ ] Lint
[ ] Build
[ ] API documentada
[ ] Banco documentado
[ ] Auditoria
[ ] Logs
[ ] RBAC
[ ] Docker
[ ] Spec Kit artifacts
[ ] Workspace criado
[ ] Artefatos identificados
[ ] Arquivos impactados registrados
[ ] Workflow atualizado
[ ] Interface funcionando
```

---

# 59. Princípios Arquiteturais Não Negociáveis

1. React + TypeScript no frontend.
2. Node.js + TypeScript no backend.
3. PostgreSQL como banco principal.
4. Monorepo.
5. REST API.
6. OpenAPI.
7. Backend é a fonte da verdade.
8. Soft delete obrigatório.
9. Auditoria obrigatória.
10. Logs obrigatórios.
11. Workspace isolado por demanda.
12. Especificações isoladas na pasta `spec`.
13. Artefatos isolados na pasta `artefatos`.
14. Artefato e repositório são conceitos independentes.
15. Providers substituíveis.
16. LLMs substituíveis.
17. Demand providers substituíveis.
18. Repository providers substituíveis.
19. SDD como metodologia principal.
20. Testes obrigatórios antes do commit.
21. PR somente após Test Gate.
22. Workflow extensível.
23. Agentes não devem possuir dependência direta de fornecedores.
24. Segredos nunca devem ser armazenados no código.
25. Código deve ser consequência da especificação.
26. Toda execução deve ser rastreável.
27. Toda alteração relevante deve ser auditável.

---

# 60. Evolução Futura

A arquitetura deverá permitir acrescentar:

```text
QA Agent
Security Agent
Code Review Agent
DevOps Agent
Release Agent
```

e:

```text
Homologation
Approval
GMUD
Production
```

sem modificar significativamente:

```text
Demand
Workspace
Specification
Artifact
Agent
Execution
Workflow
Provider
Audit
```

Essas entidades constituem o núcleo da AI Software Factory.