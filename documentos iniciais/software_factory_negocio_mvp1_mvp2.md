# Software Factory — Especificação de Negócio
## MVP 1 e MVP 2 — Gestão de Demandas, Especificação Assistida por IA e SDD

## 1. Objetivo

Construir uma Software Factory para gerenciar o ciclo de vida de demandas de software, desde o registro até o desenvolvimento e Pull Request, utilizando agentes de IA como apoio à operação.

A solução deve permitir que um analista humano produza e evolua especificações de negócio e técnicas com auxílio de uma LLM. A princípio, a LLM utilizada nesta etapa será o ChatGPT, mas a arquitetura deve permitir substituição futura por outros provedores.

A especificação aprovada será transformada em dois artefatos Markdown:

- `specify.md` — insumo para `/speckit.specify` e `/speckit.clarify`;
- `plan.md` — insumo para `/speckit.plan`.

O desenvolvimento posterior será orientado por SDD (Specification-Driven Development), com integração a GitHub inicialmente e possibilidade de outros provedores futuramente.

## 2. Escopo

### MVP 1 — Gestão e Especificação Assistida

- Clientes
- Projetos
- Tecnologias
- Repositórios
- Demandas
- Especificação manual de negócio
- Insumos técnicos fornecidos pelo analista
- Artefatos conhecidos
- Geração assistida por IA
- Revisão e edição humana
- Versionamento das especificações
- Incrementos da mesma demanda
- Aprovação de especificações
- Geração e armazenamento de `specify.md` e `plan.md`
- Histórico, timeline, logs e auditoria
- Cockpit da demanda
- Gestão de agentes e provedores de IA em nível de configuração

### MVP 2 — SDD e Desenvolvimento Assistido

- Integração com SPEC Kit
- `/speckit.specify`
- `/speckit.clarify`
- `/speckit.plan`
- Geração/gestão de tasks
- Preparação de workspace
- Identificação de artefatos
- Criação de branches
- Developer Agent
- Alterações nos repositórios
- Testes automatizados
- Commit
- Push
- Pull Request
- Acompanhamento do Git

QA Agent, homologação automatizada, GMUD e produção ficam fora dos MVPs 1 e 2.

## 3. Princípios de negócio

1. O humano é responsável pela aprovação da especificação.
2. A IA auxilia, sugere, estrutura e identifica lacunas, mas não substitui a decisão humana.
3. Nenhuma especificação aprovada deve ser sobrescrita.
4. Toda alteração relevante gera nova versão.
5. Uma demanda pode possuir múltiplos incrementos.
6. Cada incremento pode gerar nova especificação e novo plano.
7. O histórico de decisões deve ser preservado.
8. A tecnologia utilizada pelo projeto deve fazer parte do contexto fornecido à IA.
9. Artefatos conhecidos pelo analista devem poder ser informados antes da análise da IA.
10. O processo deve ser desacoplado de Monday, GitHub e de um fornecedor específico de LLM.

## 4. Conceitos principais

### Demanda

Unidade principal de trabalho, originada manualmente ou por integração externa.

Campos de negócio:

- Número/ticket externo
- Título
- Descrição
- Tipo: BUG, FEATURE/MELHORIA
- Cliente
- Projeto
- Prioridade
- Solicitante
- Data limite
- Status
- Critérios de aceite
- Observações

### Incremento

Unidade de evolução dentro de uma mesma demanda.

Exemplo:

- Incremento 1: implementação original
- Incremento 2: requisito identificado durante homologação/teste
- Incremento 3: novo ajuste

Cada incremento deve manter sua própria evolução de especificação, plano, tasks, testes e Git.

### Especificação

Conjunto de informações de negócio e técnicas utilizado para orientar o desenvolvimento.

Possui versões imutáveis após aprovação.

### Artefato

Elemento técnico envolvido na demanda, como:

- Tela
- API
- Componente
- Serviço
- Modelo
- Consulta
- Job
- Banco
- Configuração

### Tecnologia

Tecnologia utilizada por um projeto, com possibilidade de versão.

Exemplos:

- Vue 2
- Vuetify 2
- Node.js
- TypeScript
- Neo4j
- React
- PostgreSQL

### Agente

Componente de IA especializado em uma atividade.

No escopo inicial:

- Agente de Especificação/Copiloto
- Developer Agent

O sistema deve permitir novos agentes posteriormente.

## 5. Tela — Dashboard

Objetivo: fornecer visão operacional da fábrica.

Indicadores:

- Total de demandas
- Demandas abertas
- Demandas em especificação
- Demandas em desenvolvimento
- Demandas bloqueadas
- PRs abertas
- Testes falhos
- Agentes em execução
- Demandas por cliente
- Demandas por status
- Tempo médio por etapa

A tela deve permitir navegação direta para as demandas relacionadas.

## 6. Tela — Demandas

Lista com:

- Ticket
- Título
- Cliente
- Projeto
- Tipo
- Prioridade
- Status
- Incremento atual
- Agente atual
- PR
- Última atualização

Filtros:

- Cliente
- Projeto
- Tipo
- Prioridade
- Status
- Agente
- Período
- PR
- Testes

Ações:

- Visualizar
- Criar
- Editar
- Criar incremento
- Abrir cockpit

Deve existir opção de importar demanda de um registrador externo, inicialmente Monday.

## 7. Tela — Cockpit da Demanda

É a tela central do sistema.

Deve apresentar:

- Identificação da demanda
- Cliente
- Projeto
- Tipo
- Prioridade
- Incremento atual
- Status geral
- Etapa atual
- Agente atual
- Linha do tempo
- Workflow visual
- Especificações
- Artefatos
- Tasks
- Desenvolvimento
- Testes
- Git
- Auditoria

Workflow visual:

`Entrada → Especificação → Clarify → Plan → Aprovação → Tasks → Desenvolvimento → Testes → Commit → Push → PR → Homologação → Produção`

Somente as etapas pertencentes aos MVPs implementados devem ser habilitadas.

## 8. Tela — Especificação Assistida

Esta é a principal tela do MVP 1.

O analista humano deve conseguir informar:

### Informações de negócio

- O que precisa ser feito
- Problema atual
- Objetivo
- Contexto
- Regras de negócio conhecidas
- Fluxos conhecidos
- Critérios de aceite
- Restrições
- Observações

### Insumos técnicos

- Telas envolvidas
- APIs envolvidas
- Serviços conhecidos
- Componentes conhecidos
- Banco/estruturas conhecidas
- Repositórios
- Branch de produção
- Observações técnicas
- Qualquer informação previamente conhecida

O campo principal deve funcionar como um editor rico/textarea amplo, permitindo conversa incremental com a IA.

A tela deve permitir:

- Enviar para IA
- Receber proposta
- Aceitar sugestão
- Rejeitar sugestão
- Editar
- Incrementar informação
- Solicitar nova análise
- Comparar versões
- Salvar rascunho
- Aprovar versão

## 9. Interação humano + IA

Fluxo:

1. Analista registra informações.
2. Sistema monta contexto da demanda/projeto.
3. Sistema envia contexto para o provedor LLM configurado.
4. IA analisa o material.
5. IA sugere melhorias, lacunas, regras, fluxos e estrutura técnica.
6. Sistema apresenta a proposta.
7. Analista revisa.
8. Analista pode alterar diretamente ou solicitar nova contribuição à IA.
9. Nova versão de rascunho é criada.
10. Analista aprova.
11. Sistema gera `specify.md` e `plan.md`.
12. Documentos são armazenados e versionados.

A IA nunca deve aprovar a especificação em nome do humano.

## 10. Documentos produzidos

### specify.md

Deve representar principalmente:

- Objetivo
- Contexto
- Problema
- Escopo
- Requisitos funcionais
- Regras de negócio
- Fluxos
- Critérios de aceite
- Exceções
- Fora do escopo
- Observações

### plan.md

Deve representar principalmente:

- Contexto técnico
- Stack
- Arquitetura
- Artefatos
- Repositórios
- Alterações previstas
- APIs
- Banco
- Dependências
- Estratégia de testes
- Riscos
- Tasks
- Estratégia de implementação
- Branch sugerida

## 11. Versionamento

Nunca sobrescrever uma versão aprovada.

Exemplo:

`Demanda #4587`

- Incremento 1
  - specify v1
  - plan v1
  - desenvolvimento
  - testes
  - PR
- Incremento 2
  - specify v2
  - plan v2
  - desenvolvimento incremental
  - testes
  - novo PR

O sistema deve permitir comparar versões e visualizar o que mudou.

## 12. Incremento de especificação

Após implementação, o analista pode identificar requisito ausente.

Exemplo:

> Durante o teste foi identificado que o cancelamento precisa registrar o motivo.

O analista cria um novo incremento e informa a alteração.

A IA recebe:

- especificação aprovada atual
- plan atual
- informações do incremento
- contexto do projeto
- tecnologias
- artefatos
- histórico relevante

A IA deve sugerir as alterações necessárias.

O sistema deve mostrar:

- Regras adicionadas
- Artefatos impactados
- APIs impactadas
- Dados impactados
- Novos testes sugeridos
- Impactos técnicos

Após aprovação, são gerados novos `specify.md` e `plan.md`.

## 13. Tela — Tecnologias

Permitir cadastrar:

- Nome
- Categoria
- Versão
- Descrição
- Status

Categorias sugeridas:

- Frontend
- Backend
- Database
- Infraestrutura
- Testes
- DevOps
- Observabilidade
- Outros

Um projeto pode possuir várias tecnologias.

## 14. Tela — Projetos

Campos:

- Nome
- Cliente
- Descrição
- Status
- Tecnologias
- Repositórios
- Branch de produção
- Branch de homologação
- Ambiente de homologação
- Ambiente de produção

O projeto deve ser a principal fonte de contexto técnico.

## 15. Tela — Artefatos

Permitir informar artefatos conhecidos pelo analista.

Campos:

- Tipo
- Nome
- Descrição
- Projeto
- Repositório
- Path
- Tecnologia
- Observações

Exemplos:

- Tela-Clientes
- Api-Clientes

Os repositórios Git não devem ficar fisicamente dentro da pasta de especificações.

## 16. Estrutura lógica de arquivos da demanda

Cada demanda deve possuir estrutura própria:

```text
demandas/
└── {demanda}/
    ├── especificacoes/
    │   ├── incremento-01/
    │   │   ├── v1/
    │   │   │   ├── specify.md
    │   │   │   └── plan.md
    │   │   └── current/
    │   │       ├── specify.md
    │   │       └── plan.md
    │   └── incremento-02/
    ├── artefatos/
    │   ├── tela-clientes/
    │   └── api-clientes/
    ├── tasks/
    ├── testes/
    └── git/
```

Os diretórios de artefatos devem conter referências/metadados, não cópias integrais dos repositórios.

## 17. Workflow MVP 1

```text
Criar/Importar demanda
        ↓
Cadastrar contexto
        ↓
Informar negócio
        ↓
Informar insumos técnicos
        ↓
Selecionar tecnologias
        ↓
Informar artefatos conhecidos
        ↓
Enviar para IA
        ↓
Revisar
        ↓
Iterar com IA/humano
        ↓
Aprovar
        ↓
Gerar specify.md + plan.md
        ↓
Versionar
```

## 18. Workflow MVP 2

```text
Especificação aprovada
        ↓
SPEC Kit
        ↓
/speckit.specify
        ↓
/speckit.clarify
        ↓
/speckit.plan
        ↓
Tasks
        ↓
Workspace
        ↓
Branch
        ↓
Developer Agent
        ↓
Testes
        ↓
Commit
        ↓
Push
        ↓
Pull Request
```

## 19. Status sugeridos

- NEW
- ANALYSIS
- SPECIFICATION
- SPECIFICATION_REVIEW
- SPECIFICATION_APPROVED
- PLANNING
- PLANNING_REVIEW
- PLANNING_APPROVED
- READY_FOR_DEVELOPMENT
- DEVELOPMENT
- TESTING
- BLOCKED
- COMMITTING
- PULL_REQUEST
- HOMOLOGATION
- COMPLETED
- CANCELLED

## 20. Regras de aprovação

Aprovações humanas devem ser registradas.

Registrar:

- Usuário
- Data/hora
- Versão
- Incremento
- Ação
- Comentário

## 21. Auditoria

Registrar pelo menos:

- Criação/alteração de demanda
- Alteração de especificação
- Geração por IA
- Alteração humana
- Aprovação
- Rejeição
- Criação de incremento
- Alteração de artefatos
- Execução de agente
- Operações Git
- Testes
- PR

## 22. Resultado esperado

A Software Factory deve permitir que uma demanda seja acompanhada desde sua origem até o desenvolvimento, mantendo uma trilha completa de:

`necessidade → especificação → planejamento → artefatos → desenvolvimento → testes → Git → PR`

A especificação deve permanecer como fonte de verdade do processo SDD, e cada evolução deve preservar o histórico.
