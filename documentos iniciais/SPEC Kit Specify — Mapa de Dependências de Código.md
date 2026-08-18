# Feature Specification: Mapa de Dependências de Código

## 1. Objetivo

Construir um módulo de análise de dependências de software capaz de analisar repositórios de código-fonte e identificar, estruturar e armazenar relacionamentos entre telas, componentes, APIs, controllers, services, repositories, bancos de dados, caches, filas e serviços externos.

O resultado deverá ser armazenado em um banco de grafos Neo4j local, permitindo visualizar a arquitetura e consultar impactos de alterações.

O módulo fará parte da plataforma DevFactoryAI e deverá servir como base para:

- Mapeamento automático da arquitetura existente.
- Identificação de dependências entre componentes.
- Análise de impacto de alterações.
- Identificação de consumidores de APIs.
- Identificação de chamadas entre APIs.
- Identificação de dependências de infraestrutura.
- Apoio à documentação técnica gerada por IA.
- Apoio aos agentes de análise e desenvolvimento da plataforma.

---

## 2. Problema

Em sistemas existentes, frequentemente não existe documentação atualizada que permita responder rapidamente:

- Qual tela utiliza determinada API?
- Qual componente frontend chama determinado endpoint?
- Qual controller implementa uma API?
- Qual service é utilizado por determinado controller?
- Quais repositories são utilizados?
- Quais tabelas do banco são acessadas?
- Quais APIs chamam outras APIs?
- Quais serviços utilizam Redis?
- Quais serviços publicam ou consomem mensagens RabbitMQ?
- Quais serviços externos são utilizados?
- Quais telas, APIs e componentes podem ser impactados por uma alteração?

A solução deverá obter essas informações diretamente dos repositórios de código, reduzindo dependência de documentação manual.

---

## 3. Objetivo do MVP

O MVP deverá analisar um repositório local de código e construir um grafo de dependências no Neo4j.

O primeiro MVP deverá priorizar aplicações:

- React + TypeScript no frontend.
- Node.js + TypeScript no backend.

A solução deverá identificar principalmente:

### Frontend

- Projetos.
- Telas.
- Componentes.
- Serviços.
- Chamadas HTTP.
- Métodos HTTP.
- Endpoints utilizados.

### Backend

- Rotas.
- HTTP methods.
- Controllers.
- Services.
- Repositories.
- Chamadas entre métodos.
- Dependências entre camadas.

### Infraestrutura

- PostgreSQL.
- Redis.
- RabbitMQ.
- APIs externas.

---

## 4. Escopo funcional

### 4.1 Cadastro de repositório

O sistema deverá permitir registrar um repositório para análise.

Informações mínimas:

- Nome.
- URL ou caminho local.
- Branch.
- Linguagem principal.
- Tipo da aplicação.
- Data da última análise.
- Status da análise.

---

### 4.2 Análise do código

O sistema deverá percorrer os arquivos relevantes do repositório.

A análise deverá considerar:

- `.ts`
- `.tsx`
- `.js`
- `.jsx`

Arquivos e diretórios configurados como exclusão deverão ser ignorados.

Exemplos:

- `node_modules`
- `.git`
- `dist`
- `build`
- `coverage`

---

### 4.3 Identificação de telas

Para aplicações React, o sistema deverá tentar identificar:

- Pages.
- Screens.
- Routes.
- Componentes principais.

A identificação poderá utilizar:

- Estrutura de diretórios.
- React Router.
- Convenções de nomenclatura.
- Exportações.
- Componentes React.
- Evidências encontradas no AST.

---

### 4.4 Identificação de chamadas HTTP

O sistema deverá identificar chamadas HTTP realizadas pelo frontend e backend.

Deverá reconhecer, quando possível:

- `fetch`
- `axios`
- clientes HTTP customizados
- wrappers internos de API

Cada chamada deverá registrar:

- HTTP method.
- Endpoint.
- Arquivo.
- Linha.
- Função ou método.
- Componente/tela de origem.
- Projeto de origem.

Exemplo:

```text
Tela Clientes
    |
    | GET /api/clientes
    v
API Clientes
```

---

### 4.5 Identificação das APIs

No backend deverá identificar endpoints a partir das definições de rotas.

Deverá identificar:

- HTTP method.
- Path.
- Controller.
- Handler.
- Arquivo.
- Linha.

Exemplo:

```text
GET /api/clientes
POST /api/clientes
PUT /api/clientes/:id
DELETE /api/clientes/:id
```

---

### 4.6 Mapeamento Controller → Service → Repository

O sistema deverá identificar relacionamentos entre camadas.

Exemplo:

```text
ClienteController.listar
        |
        v
ClienteService.listar
        |
        v
ClienteRepository.buscarTodos
```

---

### 4.7 Identificação de banco de dados

O sistema deverá identificar evidências de acesso ao PostgreSQL.

O MVP deverá identificar:

- Biblioteca utilizada.
- Arquivo.
- Método.
- Query, quando estiver estaticamente disponível.
- Tabela identificável, quando possível.

Exemplo:

```text
ClienteRepository
       |
       v
PostgreSQL
       |
       v
clientes
```

---

### 4.8 Redis

Deverá identificar operações relacionadas ao Redis.

Exemplos:

- `get`
- `set`
- `del`
- `hget`
- `hset`

Quando possível, deverá identificar a chave utilizada.

---

### 4.9 RabbitMQ

Deverá identificar:

- Publicação de mensagens.
- Consumo de mensagens.
- Queue.
- Exchange, quando identificável.
- Routing key, quando identificável.

---

### 4.10 API → API

O sistema deverá identificar chamadas realizadas entre APIs.

Exemplo:

```text
API Clientes
    |
    | POST /api/cliente
    v
API Cadastro
```

Deverá registrar:

- API origem.
- API destino.
- HTTP method.
- Endpoint.
- Arquivo.
- Método.
- Evidência da chamada.

---

## 5. Grafo Neo4j

O sistema deverá utilizar Neo4j local como armazenamento principal das dependências identificadas.

Tipos de nós esperados:

```text
Repository
Project
Frontend
Backend
Screen
Component
Route
API
Controller
Service
RepositoryCode
Database
Table
Redis
Queue
ExternalAPI
Method
File
```

Relacionamentos esperados:

```text
CONTAINS
CALLS
EXPOSES
IMPLEMENTS
USES
DEPENDS_ON
READS
WRITES
PUBLISHES
CONSUMES
CALLS_API
USES_CACHE
```

O modelo poderá evoluir durante a implementação.

---

## 6. Evidências

Toda dependência identificada deverá possuir evidências que permitam rastrear sua origem no código.

Uma evidência deverá conter, quando disponível:

- Repository.
- Branch.
- Commit.
- Arquivo.
- Linha inicial.
- Linha final.
- Método.
- Código ou referência da expressão encontrada.
- Tipo da evidência.
- Confidence score.

Exemplo:

```text
Arquivo:
src/modules/clientes/ClienteService.ts

Linha:
42

Método:
listar()

Evidência:
axios.get('/api/clientes')
```

---

## 7. Confiança da análise

Cada relacionamento poderá possuir nível de confiança.

Valores sugeridos:

```text
HIGH
MEDIUM
LOW
```

Exemplo:

```text
Screen -> API
confidence: HIGH
```

Quando a URL for construída dinamicamente:

```text
api.get(`${baseUrl}/${resource}`)
```

a dependência poderá ser classificada como:

```text
confidence: LOW
```

---

## 8. Uso de IA

A IA não deverá substituir a análise estrutural baseada em AST.

A arquitetura deverá utilizar:

```text
AST / Static Analysis
        |
        v
Evidências objetivas
        |
        v
IA
        |
        v
Interpretação / classificação / documentação
```

A IA poderá ser utilizada para:

- Classificar componentes.
- Identificar telas.
- Interpretar chamadas dinâmicas.
- Inferir dependências não triviais.
- Explicar relacionamentos.
- Gerar documentação.
- Classificar risco.
- Sugerir dependências prováveis.

Relacionamentos inferidos exclusivamente por IA deverão ser identificados como inferidos e nunca confundidos com evidências determinísticas.

---

## 9. Consultas obrigatórias

O sistema deverá permitir responder pelo menos:

### Quais APIs uma tela utiliza?

```text
Tela → API
```

### Quais telas utilizam uma API?

```text
API ← Tela
```

### Qual código implementa uma API?

```text
API → Controller → Service
```

### Quais APIs uma API chama?

```text
API → API
```

### Quais recursos uma API utiliza?

```text
API → PostgreSQL
API → Redis
API → RabbitMQ
API → External API
```

### Qual o impacto de alterar uma API?

Deverá retornar os consumidores direta e indiretamente relacionados.

---

## 10. Critérios de aceite

### CA01 — Análise de repositório

Dado um repositório React/TypeScript ou Node/TypeScript válido, quando uma análise for executada, o sistema deverá processar os arquivos suportados e gerar dependências.

### CA02 — Frontend → API

Dada uma chamada HTTP identificável no frontend, o sistema deverá registrar a relação entre o componente/tela e a API.

### CA03 — API → Controller

Dada uma rota identificável no backend, o sistema deverá relacionar a API ao handler/controller correspondente quando possível.

### CA04 — Controller → Service

O sistema deverá identificar chamadas entre métodos quando determinadas estaticamente.

### CA05 — Service → Repository

O sistema deverá identificar dependências entre service e repository.

### CA06 — Infraestrutura

O sistema deverá identificar evidências de uso de PostgreSQL, Redis e RabbitMQ quando presentes no código.

### CA07 — Neo4j

Todas as dependências identificadas deverão ser persistidas no Neo4j local.

### CA08 — Evidência

Cada dependência deverá possuir referência ao arquivo de origem e linha quando disponível.

### CA09 — Impacto

O sistema deverá conseguir percorrer o grafo e identificar dependências relacionadas a um determinado nó.

### CA10 — IA

Dependências inferidas por IA deverão ser diferenciadas das dependências encontradas por análise estática.

---

## 11. Fora do escopo do MVP

Não faz parte do primeiro MVP:

- Análise de linguagens diferentes de JavaScript/TypeScript.
- Execução do sistema analisado.
- Testes de performance.
- Distributed tracing.
- Monitoramento de produção.
- Instrumentação em runtime.
- Kubernetes.
- Análise de binários.
- Reverse engineering de código compilado.
- Garantia de identificação de dependências construídas exclusivamente em runtime.

Esses recursos poderão ser adicionados posteriormente.

---

## 12. Resultado esperado

Ao final do MVP, deverá ser possível executar uma análise de um repositório e obter um mapa semelhante a:

```text
[Tela Clientes]
       |
       | GET /api/clientes
       v
[API Clientes]
       |
       v
[ClienteController]
       |
       v
[ClienteService]
      / \
     /   \
    v     v
[Redis] [ClienteRepository]
            |
            v
       [PostgreSQL]
            |
            v
        [clientes]
```

O grafo deverá ser persistido no Neo4j e servir como fonte estruturada para futuras funcionalidades de análise de impacto, documentação e agentes de IA.