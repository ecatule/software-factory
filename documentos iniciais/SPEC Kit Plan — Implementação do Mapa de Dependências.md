# Implementation Plan: Mapa de Dependências de Código

## 1. Objetivo técnico

Implementar um serviço de análise estática de código em Node.js + TypeScript capaz de transformar evidências encontradas nos repositórios em um grafo de dependências armazenado no Neo4j local.

Arquitetura inicial:

```text
Repository
    |
    v
Scanner
    |
    v
Parser / AST
    |
    v
Extractors
    |
    v
Dependency Model
    |
    v
Normalizer
    |
    v
Neo4j Repository
    |
    v
Dependency Graph
```

Uma camada opcional de IA será utilizada posteriormente para interpretação e inferências.

---

# 2. Arquitetura

## 2.1 Componentes

```text
dependency-analyzer/
│
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── repositories/
│   │
│   ├── application/
│   │   ├── use-cases/
│   │   └── services/
│   │
│   ├── infrastructure/
│   │   ├── parser/
│   │   ├── filesystem/
│   │   ├── neo4j/
│   │   └── git/
│   │
│   ├── analyzers/
│   │   ├── frontend/
│   │   ├── backend/
│   │   ├── http/
│   │   ├── database/
│   │   ├── redis/
│   │   └── rabbitmq/
│   │
│   └── api/
│
├── tests/
├── docs/
└── package.json
```

A implementação deverá seguir DDD de forma pragmática, evitando abstrações desnecessárias.

---

# 3. Stack

## Backend

- Node.js
- TypeScript
- REST API
- Fastify ou Express, conforme padrão adotado pelo projeto principal.

## Análise

- TypeScript Compiler API ou ts-morph.
- AST.
- Glob/fast-glob para descoberta de arquivos.

## Banco

- Neo4j local.
- Driver oficial Neo4j para Node.js.

## Git

- Git CLI ou biblioteca compatível.

## Testes

- Vitest.

## Infraestrutura

- Docker.
- Docker Compose.

---

# 4. Neo4j local

O ambiente de desenvolvimento deverá possuir Neo4j através de Docker Compose.

Exemplo conceitual:

```text
dependency-analyzer
       |
       v
    Neo4j
    :7687
    :7474
```

As credenciais deverão ser configuradas através de variáveis de ambiente.

Nunca armazenar senha diretamente no código.

Variáveis esperadas:

```text
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
NEO4J_DATABASE
```

---

# 5. Modelo de dados

## 5.1 Nodes

Inicialmente:

```text
Repository
Project
File
Screen
Component
API
Route
Controller
Service
RepositoryCode
Method
Database
Table
Redis
Queue
ExternalAPI
```

Todos os nodes deverão possuir um identificador estável.

Exemplo:

```text
(:File {
    id,
    path,
    repositoryId
})
```

---

# 6. Relacionamentos

Relacionamentos iniciais:

```text
(:Repository)-[:CONTAINS]->(:Project)

(:Project)-[:CONTAINS]->(:File)

(:Screen)-[:DEFINED_IN]->(:File)

(:Screen)-[:CALLS_API]->(:API)

(:API)-[:IMPLEMENTED_BY]->(:Controller)

(:Controller)-[:CALLS]->(:Service)

(:Service)-[:CALLS]->(:RepositoryCode)

(:RepositoryCode)-[:READS]->(:Table)

(:Service)-[:USES]->(:Redis)

(:Service)-[:PUBLISHES]->(:Queue)

(:Service)-[:CONSUMES]->(:Queue)

(:Service)-[:CALLS_API]->(:ExternalAPI)
```

O modelo deverá ser versionável para permitir evolução futura.

---

# 7. Identificador dos elementos

Não utilizar somente o nome da entidade como identificador.

Exemplo:

```text
ClienteService
```

pode existir em vários repositórios.

Um identificador deverá considerar:

```text
repository
project
file
symbol
```

Exemplo conceitual:

```text
repo:sistema-a|project:backend|file:src/clientes/ClienteService.ts|symbol:listar
```

---

# 8. Pipeline de análise

## Etapa 1 — Descoberta

Receber:

```text
repositoryPath
branch
project
```

Localizar arquivos:

```text
.ts
.tsx
.js
.jsx
```

Ignorar:

```text
node_modules
.git
dist
build
coverage
```

---

## Etapa 2 — Parsing

Cada arquivo TypeScript/JavaScript deverá ser convertido em AST.

O parser deverá produzir uma estrutura intermediária.

Exemplo:

```text
File
 ├── imports
 ├── exports
 ├── classes
 ├── functions
 ├── methods
 ├── calls
 └── literals
```

---

# 9. Extractor de Frontend

Criar:

```text
ReactScreenAnalyzer
```

Responsabilidades:

- Identificar possíveis telas.
- Identificar componentes.
- Identificar hooks.
- Identificar imports.
- Identificar chamadas HTTP.
- Relacionar chamada HTTP ao arquivo/método/componente.

Detectar inicialmente:

```text
fetch
axios
api.get
api.post
api.put
api.patch
api.delete
```

Exemplo:

```ts
api.get('/clientes')
```

deverá gerar:

```text
Screen
   |
   | CALLS_API
   v
API GET /clientes
```

---

# 10. Extractor de Backend

Criar:

```text
BackendRouteAnalyzer
```

Responsabilidades:

- Identificar rotas.
- Identificar HTTP methods.
- Identificar controllers/handlers.
- Identificar middleware.
- Identificar chamadas para services.

Suportar inicialmente padrões comuns de Express/Fastify.

Exemplo:

```ts
router.get('/clientes', clienteController.listar)
```

resultado:

```text
API GET /clientes
        |
        v
ClienteController.listar
```

---

# 11. Extractor Controller/Service

Criar:

```text
MethodDependencyAnalyzer
```

O analisador deverá utilizar AST para descobrir chamadas entre métodos.

Exemplo:

```ts
clienteService.listar()
```

deverá gerar:

```text
ClienteController.listar
        |
        v
ClienteService.listar
```

Quando a resolução do símbolo não for possível, registrar a evidência como parcial.

---

# 12. Extractor Repository

Identificar chamadas para:

- PostgreSQL.
- Drivers SQL.
- Query builders.
- ORM utilizado pelo projeto.

Inicialmente, priorizar reconhecimento de queries SQL literais.

Exemplo:

```ts
SELECT * FROM clientes
```

deverá tentar identificar:

```text
RepositoryCode
      |
      | READS
      v
Table: clientes
```

---

# 13. Extractor Redis

Detectar:

```text
redis.get
redis.set
redis.del
redis.hget
redis.hset
```

Criar relacionamento:

```text
Service
   |
   | USES
   v
Redis
```

Quando a chave for literal, armazená-la como propriedade da evidência.

---

# 14. Extractor RabbitMQ

Detectar:

```text
sendToQueue
publish
consume
assertQueue
```

Registrar:

```text
Service
   |
   | PUBLISHES
   v
Queue
```

e:

```text
Queue
   |
   | CONSUMED_BY
   v
Service
```

---

# 15. Extractor HTTP

Criar um extractor independente:

```text
HttpCallAnalyzer
```

Ele deverá produzir um objeto normalizado:

```ts
interface HttpDependency {
    method: string;
    url: string;
    sourceFile: string;
    sourceLine: number;
    sourceSymbol?: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}
```

Isso permitirá utilizar o mesmo extractor em frontend e backend.

---

# 16. Modelo de evidência

Toda descoberta deverá possuir:

```ts
interface DependencyEvidence {
    repositoryId: string;
    projectId: string;
    sourceFile: string;
    sourceLine?: number;
    sourceSymbol?: string;
    evidenceType: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}
```

A evidência deverá ser persistida junto ao relacionamento ou em entidade própria, conforme decisão final de implementação.

---

# 17. Persistência Neo4j

Criar:

```text
Neo4jDependencyRepository
```

Responsabilidades:

- Criar nodes.
- Criar relacionamentos.
- Atualizar nodes existentes.
- Evitar duplicidade.
- Associar evidências.
- Executar consultas de impacto.

Utilizar constraints e indexes.

Exemplo conceitual:

```cypher
CREATE CONSTRAINT repository_id IF NOT EXISTS
FOR (r:Repository)
REQUIRE r.id IS UNIQUE;
```

---

# 18. Idempotência

Uma nova análise do mesmo commit não deverá criar duplicidades.

O sistema deverá utilizar identificadores determinísticos.

Exemplo:

```text
repository + commit + file + symbol
```

A análise deverá poder ser executada novamente sem corromper o grafo.

---

# 19. Versionamento da análise

Cada execução deverá possuir:

```text
analysisId
repository
branch
commit
startedAt
finishedAt
status
```

Isso permitirá posteriormente comparar:

```text
Análise A
     vs
Análise B
```

e identificar alterações arquiteturais.

---

# 20. API do analisador

Criar endpoints REST semelhantes a:

```text
POST /repositories
GET  /repositories
POST /repositories/:id/analyze
GET  /repositories/:id/analyses
GET  /repositories/:id/dependencies
GET  /repositories/:id/impact
```

A API deverá ser documentada com OpenAPI/Swagger.

---

# 21. Consulta de impacto

Criar use case:

```text
AnalyzeDependencyImpact
```

Entrada:

```text
nodeId
```

Saída:

```text
directDependencies
indirectDependencies
consumers
affectedScreens
affectedApis
affectedServices
affectedInfrastructure
risk
```

Exemplo:

```text
GET /api/clientes
```

retornará:

```text
Telas afetadas:
- Clientes
- Dashboard

Services:
- ClienteService

Infra:
- Redis
- PostgreSQL
```

---

# 22. IA

A integração com IA deverá ser desacoplada do scanner.

Criar interface:

```ts
interface DependencyInferenceService {
    infer(context: DependencyContext): Promise<InferenceResult>;
}
```

O scanner deverá funcionar normalmente sem IA.

A IA poderá posteriormente:

- Resolver dependências ambíguas.
- Classificar telas.
- Identificar APIs semanticamente.
- Explicar relacionamentos.
- Detectar possíveis dependências não encontradas pelo parser.
- Gerar documentação.

Toda inferência deverá possuir:

```text
source = AI
confidence
reason
```

---

# 23. Segurança

O scanner não deverá executar código do repositório analisado.

A análise deverá ser exclusivamente estática no MVP.

Isso é importante para evitar que um repositório contenha scripts maliciosos executados durante a análise.

O sistema deverá:

- Não executar `npm install` automaticamente.
- Não executar scripts do projeto.
- Não executar `postinstall`.
- Não iniciar aplicações analisadas.

---

# 24. Testes

Criar testes unitários para cada analyzer.

Estrutura:

```text
tests/
├── frontend/
├── backend/
├── http/
├── database/
├── redis/
├── rabbitmq/
├── neo4j/
└── integration/
```

Criar fixtures pequenas de código.

Exemplo:

```text
fixture/
├── frontend/
│   └── Clientes.tsx
└── backend/
    ├── ClienteController.ts
    ├── ClienteService.ts
    └── ClienteRepository.ts
```

A análise da fixture deverá gerar um grafo conhecido.

---

# 25. Teste de integração

Executar Neo4j em Docker.

Fluxo:

```text
Fixture
   |
   v
Scanner
   |
   v
Neo4j
   |
   v
Cypher assertions
```

Validar:

```text
Screen -> API
API -> Controller
Controller -> Service
Service -> Repository
Repository -> Table
Service -> Redis
```

---

# 26. Observabilidade

Registrar:

- Repository analisado.
- Commit.
- Quantidade de arquivos.
- Quantidade de arquivos suportados.
- Quantidade de nodes criados.
- Quantidade de relacionamentos criados.
- Tempo da análise.
- Erros.
- Warnings.

Exemplo:

```text
Analysis completed

Files: 1.248
Analyzed: 984
Skipped: 264

Nodes: 3.421
Relationships: 5.893

Warnings: 17
Errors: 2

Duration: 38s
```

---

# 27. Performance

A análise deverá:

- Processar arquivos de forma incremental.
- Evitar parsing repetido.
- Utilizar cache quando possível.
- Realizar operações Neo4j em lote.
- Evitar uma transação por node.
- Permitir análise incremental em versões futuras.

---

# 28. Docker

Criar:

```text
docker-compose.yml
```

com:

```text
neo4j
```

O ambiente deverá permitir:

```bash
docker compose up -d
```

e disponibilizar:

```text
Neo4j Browser
Bolt
HTTP
```

---

# 29. CLI

Além da API, criar uma CLI para facilitar o desenvolvimento.

Exemplo:

```bash
dependency-map analyze ./meu-repositorio
```

Opções:

```text
--branch
--commit
--project
--neo4j-uri
--output
--ai
```

Exemplo:

```bash
dependency-map analyze ./sistema
  --branch main
  --project sistema-backend
```

---

# 30. Artefatos

O `/speckit.plan` deverá produzir/manter:

```text
Artefatos/
└── MapaDependencias/
    ├── arquitetura.md
    ├── modelo-neo4j.md
    ├── regras-analisadores.md
    ├── api.md
    ├── cli.md
    └── testes.md
```

A documentação deverá ser atualizada conforme decisões técnicas forem tomadas durante a implementação.

---

# 31. Ordem de implementação

## Fase 1 — Infraestrutura

- Criar projeto Node/TypeScript.
- Configurar TypeScript.
- Configurar Vitest.
- Criar Docker Compose.
- Subir Neo4j.
- Configurar driver Neo4j.

## Fase 2 — Modelo

- Criar entidades.
- Criar modelo de evidências.
- Criar identificadores.
- Criar repository Neo4j.
- Criar constraints/indexes.

## Fase 3 — Scanner

- Descoberta de arquivos.
- Parser AST.
- Modelo intermediário.
- Análise de imports.
- Análise de métodos.

## Fase 4 — Frontend

- Identificação de telas.
- Componentes.
- Chamadas HTTP.
- Relação Tela → API.

## Fase 5 — Backend

- Routes.
- APIs.
- Controllers.
- Services.
- Repositories.

## Fase 6 — Infraestrutura

- PostgreSQL.
- Redis.
- RabbitMQ.
- APIs externas.

## Fase 7 — Grafo

- Persistência.
- Queries.
- Impact analysis.

## Fase 8 — API

- CRUD de repositories.
- Execução de análise.
- Consulta de dependências.
- Consulta de impacto.

## Fase 9 — CLI

- Comando analyze.
- Opções.
- Logs.
- Relatório.

## Fase 10 — IA

- Interface de inferência.
- Context builder.
- Classificação.
- Explicações.
- Inferências.

---

# 32. Critério de conclusão do MVP

O MVP será considerado concluído quando for possível:

1. Subir Neo4j localmente com Docker.
2. Registrar um repositório React/TypeScript + Node/TypeScript.
3. Executar uma análise.
4. Identificar pelo menos uma tela.
5. Identificar chamadas HTTP.
6. Identificar endpoints backend.
7. Relacionar tela → API.
8. Relacionar API → Controller.
9. Relacionar Controller → Service.
10. Relacionar Service → Repository.
11. Identificar PostgreSQL.
12. Identificar Redis.
13. Identificar RabbitMQ.
14. Persistir o grafo no Neo4j.
15. Consultar dependências.
16. Consultar impacto.
17. Apresentar evidências com arquivo e linha.
18. Executar testes automatizados.
19. Reexecutar a análise sem gerar duplicidades.
20. Funcionar sem dependência obrigatória de IA.

---

# 33. Princípio arquitetural

A regra fundamental do projeto será:

```text
ANÁLISE ESTÁTICA É A FONTE DE EVIDÊNCIA.
IA É A CAMADA DE INTERPRETAÇÃO.
NEO4J É A FONTE DO GRAFO DE DEPENDÊNCIAS.
```

A IA nunca deverá substituir evidências encontradas diretamente no código.

Dependências determinísticas e inferidas deverão permanecer claramente diferenciadas.

O sistema deverá ser preparado para posteriormente incorporar análise dinâmica/tracing, porém essa capacidade não faz parte do MVP.