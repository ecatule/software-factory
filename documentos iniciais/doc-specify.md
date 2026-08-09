# AI Software Factory — Product Specification

## 1. Visão Geral

Construir uma plataforma denominada provisoriamente **AI Software Factory**, destinada a gerenciar e automatizar uma fábrica de software utilizando Agentes de Inteligência Artificial e a metodologia **Spec-Driven Development (SDD)**.

A plataforma deverá controlar o ciclo de vida de uma demanda de software desde sua entrada até a implementação e abertura do Pull Request.

O processo deverá manter rastreabilidade completa:

```text
Demanda
   ↓
Especificação
   ↓
Clarificação
   ↓
Plano técnico
   ↓
Artefatos
   ↓
Tasks
   ↓
Arquivos impactados
   ↓
Implementação
   ↓
Testes
   ↓
Commit
   ↓
Pull Request
```

A plataforma será inicialmente integrada a:

- Monday para origem das demandas;
- GitHub para versionamento;
- ChatGPT e/ou Claude como LLMs;
- Spec Kit para SDD.

Essas tecnologias deverão ser tratadas como **providers substituíveis**.

O Core da aplicação não poderá depender diretamente de Monday, GitHub, ChatGPT, Claude ou outro fornecedor específico.

---

# 2. Objetivo

O objetivo é transformar o processo atual de desenvolvimento de software em um processo controlado, rastreável e parcialmente automatizado por agentes de IA.

Processo atual:

```text
Monday
   ↓
Analista
   ↓
Desenvolvedor
   ↓
Código
   ↓
PR
   ↓
Homologação
   ↓
GMUD
   ↓
Produção
```

Processo desejado:

```text
Monday
   ↓
Demanda
   ↓
Agente Analista
   ↓
Specify
   ↓
Clarify
   ↓
Plan
   ↓
Checklist
   ↓
Tasks
   ↓
Analyze
   ↓
Identificação dos Artefatos
   ↓
Criação do Workspace
   ↓
Branch
   ↓
Agente Developer
   ↓
Implementação
   ↓
Testes automatizados
   ↓
Commit
   ↓
Push
   ↓
Pull Request
```

Posteriormente serão incorporados:

```text
QA Agent
   ↓
Homologação
   ↓
Aprovação
   ↓
GMUD
   ↓
Produção
```

---

# 3. Spec-Driven Development

O desenvolvimento deverá utilizar **Spec-Driven Development (SDD)** como metodologia principal.

O Spec Kit deverá ser incorporado ao projeto.

Fluxo inicial:

```text
/speckit.specify
       ↓
/speckit.clarify
       ↓
/speckit.plan
       ↓
/speckit.checklist
       ↓
/speckit.tasks
       ↓
/speckit.analyze
       ↓
/speckit.implement
```

A plataforma deverá controlar as execuções do Spec Kit e seus respectivos artefatos.

---

# 4. LLMs

A plataforma deverá permitir utilizar diferentes LLMs em diferentes etapas.

Exemplo:

```text
Specification
    ↓
ChatGPT

Development
    ↓
Claude
```

Essa definição deverá ser configurável.

O sistema deverá permitir futuramente:

```text
Specification Agent
 ├── ChatGPT
 ├── Claude
 ├── Gemini
 └── Outro

Developer Agent
 ├── Claude
 ├── Codex
 ├── Gemini
 └── Outro
```

O domínio deverá conhecer somente a abstração:

```text
LLMProvider
```

---

# 5. Demandas

A demanda será a entidade central do sistema.

Cada demanda deverá possuir:

- identificador interno;
- identificador externo;
- título;
- descrição;
- tipo;
- prioridade;
- cliente;
- projeto;
- origem;
- status;
- estágio atual;
- responsável;
- datas;
- histórico;
- workspace;
- artefatos;
- especificações;
- execuções;
- branch;
- commits;
- testes;
- Pull Requests.

Tipos iniciais:

```text
BUG
FEATURE
IMPROVEMENT
TASK
TECHNICAL_DEBT
```

---

# 6. Workspace da Demanda

Cada demanda deverá possuir um **workspace próprio**.

O workspace representa o ambiente de trabalho utilizado pelos agentes durante o ciclo de desenvolvimento.

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

O workspace deverá ser criado automaticamente quando a demanda entrar no fluxo de desenvolvimento.

---

# 7. Pasta `spec`

A pasta:

```text
spec/
```

deverá conter **exclusivamente os documentos relacionados ao SDD**.

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

Não deverá conter código-fonte dos projetos.

---

# 8. Pasta `artefatos`

A pasta:

```text
artefatos/
```

representa os componentes de software envolvidos na implementação da demanda.

Exemplo:

```text
artefatos/
├── Tela-Clientes/
├── API-Clientes/
└── Banco-Clientes/
```

Cada subpasta representa um **artefato lógico**.

O conteúdo poderá representar o workspace de código utilizado pelo Developer Agent.

---

# 9. Artefato x Repositório

Artefato e repositório Git são conceitos diferentes.

Um artefato pode pertencer a um repositório.

Vários artefatos também podem pertencer ao mesmo repositório.

Exemplo:

```text
Tela-Clientes ─────┐
                   ├── GitHub: sistema-cliente
API-Clientes ──────┘
```

Outro cenário:

```text
Tela-Clientes ──── GitHub: frontend
API-Clientes ───── GitHub: backend
Banco-Clientes ─── GitHub: database
```

A arquitetura deverá suportar ambos os cenários.

---

# 10. Exemplo de Artefatos

Uma demanda poderá identificar:

```text
artefatos/
├── Tela-Clientes/
│   └── metadata.yaml
│
├── API-Clientes/
│   └── metadata.yaml
│
└── Banco-Clientes/
    └── metadata.yaml
```

Exemplo de `metadata.yaml`:

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

# 11. Escopo dos Artefatos

Cada artefato deverá possuir um escopo explícito.

Exemplo:

```yaml
artifact:
  name: Tela-Clientes
  type: frontend
  technology: React
  path: src/features/clientes

  files:
    - ClienteList.tsx
    - ClienteForm.tsx
    - ClienteService.ts
```

O objetivo é permitir ao Developer Agent saber exatamente quais partes do sistema estão inicialmente dentro do escopo.

---

# 12. Arquivos Impactados

O planejamento deverá identificar os arquivos que provavelmente serão alterados.

Exemplo:

```text
Tela-Clientes

Arquivos previstos:

src/features/clientes/ClienteList.tsx
src/features/clientes/ClienteForm.tsx
src/features/clientes/ClienteService.ts
```

O Developer Agent poderá descobrir arquivos adicionais.

Quando isso ocorrer deverá:

1. registrar o novo arquivo;
2. relacioná-lo ao artefato;
3. registrar a justificativa;
4. manter o histórico.

---

# 13. Rastreabilidade

A plataforma deverá permitir rastrear:

```text
Demanda
   ↓
Especificação
   ↓
Artefato
   ↓
Task
   ↓
Arquivo
   ↓
Commit
   ↓
Teste
   ↓
Pull Request
```

Exemplo:

```text
4587
 └── Tela-Clientes
      ├── Task 01
      ├── ClienteList.tsx
      ├── ClienteForm.tsx
      ├── Commit a82f91c
      ├── Test #9821
      └── PR #382
```

---

# 14. Especificações

Cada demanda deverá possuir versões das especificações.

Principais documentos:

```text
spec.md
plan.md
research.md
data-model.md
quickstart.md
checklist.md
tasks.md
analysis.md
```

A plataforma deverá permitir:

- visualizar;
- editar;
- versionar;
- comparar;
- restaurar;
- aprovar;
- identificar autor;
- identificar agente;
- identificar LLM;
- identificar execução.

---

# 15. Versionamento das Especificações

Nenhuma especificação deverá ser sobrescrita sem preservar seu histórico.

Exemplo:

```text
spec.md
 ├── v1
 ├── v2
 ├── v3
 └── v4
```

Cada versão deverá registrar:

- usuário;
- agente;
- LLM;
- data;
- execução;
- motivo;
- conteúdo.

---

# 16. Origem das Demandas

Inicialmente as demandas serão recebidas do Monday.

Deverá existir:

```text
DemandProvider
```

Implementação inicial:

```text
MondayDemandProvider
```

Futuramente:

```text
JiraDemandProvider
AzureDevOpsDemandProvider
ServiceNowDemandProvider
Outro
```

O Core não deverá conhecer o Monday diretamente.

---

# 17. Clientes

Cada demanda deverá estar associada a um cliente.

Um cliente poderá possuir vários projetos.

Exemplo:

```text
Cliente A
 ├── Projeto Financeiro
 ├── Projeto Comercial
 └── Portal
```

---

# 18. Projetos

Cada projeto deverá possuir:

- cliente;
- repositório;
- tecnologias;
- ambientes;
- branch strategy;
- configurações;
- regras de desenvolvimento;
- testes obrigatórios.

A plataforma será desenvolvida utilizando:

```text
Frontend: React + TypeScript
Backend: Node.js + TypeScript
Database: PostgreSQL
```

---

# 19. Repositórios

Deverá existir:

```text
CodeRepositoryProvider
```

Implementação inicial:

```text
GitHubRepositoryProvider
```

Futuramente:

```text
GitLabRepositoryProvider
BitbucketRepositoryProvider
AzureDevOpsRepositoryProvider
Outro
```

---

# 20. Workflow

O workflow inicial será:

```text
NEW
 ↓
SPECIFICATION
 ↓
CLARIFICATION
 ↓
PLANNING
 ↓
CHECKLIST
 ↓
TASKS
 ↓
ANALYSIS
 ↓
READY_FOR_DEVELOPMENT
 ↓
DEVELOPMENT
 ↓
TESTING
 ↓
COMMIT
 ↓
PULL_REQUEST
```

Estados adicionais:

```text
BLOCKED
FAILED
CANCELLED
```

Futuramente:

```text
QA
HOMOLOGATION
APPROVAL
GMUD
PRODUCTION
DONE
```

O workflow deverá ser extensível.

---

# 21. Agente Analista

O Agente Analista será responsável por transformar a necessidade da demanda em especificação estruturada.

Entrada:

- demanda;
- cliente;
- projeto;
- descrição;
- regras de negócio;
- documentação existente;
- contexto do projeto;
- conhecimento técnico.

Saída:

```text
spec.md
research.md
plan.md
data-model.md
checklist.md
tasks.md
analysis.md
```

Também deverá identificar:

- artefatos;
- arquivos potencialmente impactados;
- dependências;
- riscos;
- critérios de aceite.

---

# 22. Developer Agent

O Developer Agent deverá receber:

```text
workspace/<demanda>/
```

Incluindo:

```text
spec/
artefatos/
```

Além de:

- cliente;
- projeto;
- repositórios;
- branch;
- regras técnicas;
- tasks;
- artefatos;
- arquivos impactados.

Deverá:

- analisar o código;
- implementar;
- executar testes;
- corrigir falhas;
- produzir relatório;
- preparar commit;
- criar Pull Request.

---

# 23. Branch

A branch deverá ser criada automaticamente.

Padrão inicial:

```text
<tipo>/<cliente>/<ticket>-<slug>
```

Exemplos:

```text
bug/cliente-a/4587-correcao-cancelamento

feature/cliente-a/4621-novo-relatorio

improvement/cliente-b/4701-dashboard
```

A política deverá ser configurável por projeto.

---

# 24. Testes

A plataforma deverá executar testes automatizados antes do commit.

Tipos:

```text
Unit Tests
Integration Tests
API Tests
Contract Tests
Lint
Build
```

Os testes obrigatórios serão configuráveis por projeto.

---

# 25. Test Gate

O fluxo deverá impedir o commit quando testes obrigatórios falharem.

```text
DEVELOPMENT
   ↓
TESTING
   ↓
Todos os testes passaram?
   │
   ├── NÃO → FAILED
   │
   └── SIM
         ↓
       COMMIT
```

---

# 26. Git

Após aprovação dos testes:

```text
Commit
 ↓
Push
 ↓
Pull Request
```

Todas as operações deverão ser relacionadas à demanda.

---

# 27. Pull Request

O sistema deverá criar automaticamente o Pull Request.

O PR deverá conter:

- título;
- descrição;
- demanda;
- cliente;
- resumo;
- artefatos;
- tasks;
- arquivos alterados;
- testes;
- riscos.

---

# 28. Cockpit da Demanda

A plataforma deverá possuir uma tela de acompanhamento completa.

Exemplo:

```text
====================================================
DEMANDA #4587
Correção do cancelamento
====================================================

Cliente: Cliente A
Projeto: Sistema X
Tipo: BUG

WORKFLOW

✓ Specification
✓ Clarification
✓ Planning
✓ Tasks
✓ Analysis
● Development
○ Testing
○ Commit
○ Pull Request

----------------------------------------------------

WORKSPACE

workspace/4587-correcao-cancelamento/

----------------------------------------------------

ARTEFATOS

✓ Tela-Clientes
✓ API-Clientes
○ Banco-Clientes

----------------------------------------------------

GIT

Branch:
bug/cliente-a/4587-correcao-cancelamento

----------------------------------------------------

TESTES

Unit Tests: PENDING
Integration: PENDING

----------------------------------------------------

PULL REQUEST

Pendente
====================================================
```

---

# 29. Tela de Artefatos

Deverá permitir visualizar:

```text
Artefato
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

# 30. Tela de Especificação

Deverá possuir:

- editor Markdown;
- preview;
- histórico;
- comparação de versões;
- restauração;
- autor;
- agente;
- LLM;
- execução.

---

# 31. Tela de Testes

Deverá apresentar:

```text
Suite
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

# 32. Timeline

A demanda deverá possuir timeline.

Exemplo:

```text
10:00 Demanda criada
10:02 Specification Agent iniciado
10:05 spec.md v1 criado
10:10 Clarification concluída
10:15 plan.md criado
10:20 Artefatos identificados
10:25 Tasks criadas
10:30 Analysis aprovado
10:32 Workspace criado
10:34 Branch criada
10:35 Developer Agent iniciado
10:50 Testes executados
10:55 Commit criado
10:57 PR criado
```

---

# 33. MVP 1

O MVP 1 deverá entregar:

### Fundação

- Monorepo;
- React + TypeScript;
- Node.js + TypeScript;
- PostgreSQL;
- REST;
- OpenAPI;
- Docker.

### Gestão

- usuários;
- RBAC;
- clientes;
- projetos;
- demandas;
- agentes;
- providers;
- workflows.

### SDD

- integração Spec Kit;
- specify;
- clarify;
- plan;
- checklist;
- tasks;
- analyze;
- workspace;
- artefatos;
- versionamento.

### Interface

- dashboard;
- demandas;
- cockpit;
- workflow;
- artefatos;
- especificações;
- execuções;
- timeline.

---

# 34. MVP 2

O MVP 2 deverá entregar:

- GitHub Provider;
- Repository;
- Branch;
- Branch Policy;
- Developer Agent;
- workspace de desenvolvimento;
- implementação;
- testes automatizados;
- Test Gate;
- Commit;
- Push;
- Pull Request;
- acompanhamento Git;
- acompanhamento dos testes.

---

# 35. Fora dos MVPs

Não implementar inicialmente:

- QA Agent completo;
- homologação automática;
- produção automática;
- GMUD automática;
- Kubernetes operacional;
- múltiplos agentes concorrentes;
- marketplace de agentes;
- RAG avançado.

A arquitetura deverá permitir essas funcionalidades futuramente.

---

# 36. Segurança

Implementar:

- OAuth2;
- OpenID Connect;
- JWT;
- Refresh Token;
- RBAC;
- Rate Limit;
- Middleware;
- LGPD;
- criptografia;
- auditoria.

O backend será a fonte da verdade.

---

# 37. Banco de Dados

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

Delete físico é proibido.

---

# 38. Filosofia

Priorizar:

- simplicidade de manutenção;
- clareza;
- baixo acoplamento;
- alta coesão;
- extensibilidade;
- rastreabilidade;
- automação;
- segurança;
- evolução sem alterar o Core.

---

# 39. Providers

O sistema deverá utilizar abstrações:

```text
DemandProvider
CodeRepositoryProvider
LLMProvider
SDDProvider
StorageProvider
```

Implementações iniciais:

```text
MondayDemandProvider
GitHubRepositoryProvider
ChatGPTProvider
ClaudeProvider
SpecKitProvider
MinioStorageProvider
```

---

# 40. Princípio Fundamental

O código deverá ser consequência da especificação.

A Software Factory deverá seguir:

```text
Necessidade
   ↓
Especificação
   ↓
Plano
   ↓
Artefatos
   ↓
Workspace
   ↓
Tasks
   ↓
Código
   ↓
Testes
   ↓
Commit
   ↓
PR
```

Nunca utilizar o Developer Agent como substituto da análise e especificação.

---

# 41. Critério de Sucesso

Uma demanda deverá conseguir percorrer:

```text
Monday
 ↓
Demand
 ↓
Specification
 ↓
Clarification
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
Branch
 ↓
Developer Agent
 ↓
Implementation
 ↓
Automated Tests
 ↓
Commit
 ↓
Pull Request
```

Todo o processo deverá ser acompanhado através da interface da AI Software Factory.

---

# 42. Rastreabilidade Obrigatória

Para qualquer demanda deverá ser possível responder:

- Qual cliente?
- Qual projeto?
- Qual requisito?
- Qual especificação?
- Qual versão da especificação?
- Qual workspace?
- Quais artefatos?
- Qual repositório de cada artefato?
- Qual branch?
- Quais arquivos?
- Quais tasks?
- Qual agente?
- Qual LLM?
- Quais commits?
- Quais testes?
- Qual resultado?
- Qual Pull Request?
- Quem realizou cada ação?
- Quando?

---

# 43. Regra Arquitetural do Workspace

O workspace pertence exclusivamente a uma demanda.

A estrutura deverá ser:

```text
workspace/
└── <ticket>-<slug>/
    ├── spec/
    └── artefatos/
```

A pasta `spec` contém somente especificações.

A pasta `artefatos` contém somente os componentes de código envolvidos na demanda.

Nenhum repositório Git deverá ser colocado no mesmo nível de `spec`.

Um ou mais artefatos poderão utilizar o mesmo repositório Git.

Essa regra deverá ser respeitada pelos agentes e pelos componentes da plataforma.