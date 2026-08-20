# Feature Specification: Agente QA, Geração de Testes e Validação Funcional

**Feature Branch**: `[006-qa-agent-test-generation]`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Evoluir a fábrica de software orientada por IA para incorporar uma etapa formal de Quality Assurance (QA) após a implementação do código — geração automática e obrigatória de Casos de Teste (positivos, negativos, autorização, autenticação, integração, regressão) por um Agente QA dedicado, sem execução automática inicial; teste funcional manual em homologação (API e Web) com evidências e resultado PASS/FAIL/BLOCKED/NOT_EXECUTED; Environment Guard técnico que bloqueia qualquer execução contra produção ou ambiente não autorizado, independente da decisão da IA. Documento de origem: `documentos iniciais/SPECIFY — Agente QA, Geração de Testes e Validação Funcional.md`."

## Clarifications

### Session 2026-08-20

- Q: "Caso de Teste" (independente de tecnologia — título, pré-condições, dados, passos, resultado esperado, executável depois via Browser/API/Banco) é um registro estruturado novo no banco da plataforma, gerado por um Agente QA dedicado, ou é formalizar o que o Developer Agent já faz hoje (escrever arquivos de teste de código real, sem executá-los, quando o repositório já tem framework configurado)? → A: Registro estruturado novo, no banco da plataforma, gerado por um Agente QA dedicado (novo tipo de Agent, novo estágio de pipeline) — independente de linguagem/framework, para ser executado depois por qualquer executor (Web/API). Não substitui nem depende dos arquivos de teste de código que o Developer Agent já escreve — são coisas complementares, não a mesma coisa.
- Q: Quem pode disparar a execução manual dos testes funcionais em homologação (User Story 3)? → A: Uma nova permissão dedicada `QA_EXECUTE` — mesmo padrão de uma-permissão-por-recurso-sensível já usado na plataforma (ex.: `ERROR_LOG_READ` mantida separada de `AUDIT_READ`), já que a execução funcional atinge um ambiente real.
- Q: A configuração de execução automática (`TEST_EXECUTION_ENABLED`) é definida em qual nível? → A: Por Projeto — mesmo padrão já usado por `Project.requiredTestSuites`, já que projetos/clientes diferentes podem querer habilitar isso em momentos diferentes.
- Q: Se o Agente QA tentar gerar os Casos de Teste e ocorrer um erro genuíno (não "nenhum cenário aplicável"), o que deve acontecer? → A: Bloqueia o Commit — mesmo comportamento do Test Gate (`assertTestGatePassed`) já existente para testes de unidade: uma falha real na etapa obrigatória impede o avanço, só a ausência de cenário aplicável (não um erro) é que não bloqueia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Geração automática de Casos de Teste após a implementação (Priority: P1) 🎯 MVP

Assim que o Developer Agent conclui a implementação de uma demanda, o Agente QA é acionado automaticamente e analisa `spec.md`, `plan.md`, os requisitos e critérios de aceite, as regras de negócio, o diff da implementação e a estrutura da aplicação para gerar os Casos de Teste da demanda — cobrindo cenários positivos, negativos, de autorização, de autenticação, de integração (quando aplicável) e de regressão. A geração é obrigatória no fluxo; a execução desses casos não acontece nesta etapa.

**Why this priority**: É o núcleo da feature e a única parte que já entrega valor sozinha — sem Casos de Teste gerados, não há o que executar manualmente em homologação (User Story 3) nem o que revisar antes do PR.

**Independent Test**: Pode ser totalmente testado concluindo a implementação de uma demanda e confirmando que os Casos de Teste aparecem disponíveis para consulta, cobrindo pelo menos um cenário positivo e um negativo, sem que nenhuma execução tenha ocorrido.

**Acceptance Scenarios**:

1. **Given** uma demanda cuja implementação acabou de ser concluída pelo Developer Agent, **When** o Agente QA é acionado, **Then** os Casos de Teste da demanda são gerados e ficam disponíveis para consulta, sem nenhuma execução ter ocorrido.
2. **Given** uma demanda com critérios de aceite e regras de negócio definidos em `spec.md`, **When** os Casos de Teste são gerados, **Then** existe pelo menos um Caso de Teste cobrindo um cenário positivo e pelo menos um cobrindo um cenário negativo derivados desses critérios.
3. **Given** uma demanda cuja implementação afeta uma API protegida por autenticação/autorização, **When** os Casos de Teste são gerados, **Then** existem Casos de Teste específicos para acesso não autenticado (401 esperado) e acesso sem permissão (403 esperado).
4. **Given** uma demanda cuja implementação pode afetar funcionalidade existente, **When** os Casos de Teste são gerados, **Then** existe pelo menos um Caso de Teste de regressão cobrindo a funcionalidade potencialmente impactada.

---

### User Story 2 - Bloqueio técnico contra execução em ambiente não autorizado (Priority: P1)

Antes de qualquer execução de teste funcional ser permitida, o sistema valida tecnicamente se o ambiente-alvo (URL da aplicação, da API, banco, filas, storage, serviços externos, gateways, credenciais) é um ambiente de homologação autorizado. Se o ambiente for identificado como produção ou como não autorizado, a execução é bloqueada antes de qualquer chamada real acontecer — essa proteção não pode depender exclusivamente de uma decisão da IA.

**Why this priority**: É um requisito de segurança obrigatório e bloqueador — nenhuma capacidade de execução real (User Story 3) pode existir com segurança sem essa proteção já funcionando, então ela precisa estar pronta antes.

**Independent Test**: Pode ser totalmente testado configurando um ambiente-alvo reconhecido como produção (ou não reconhecido) e confirmando que a tentativa de execução é bloqueada tecnicamente, sem que nenhuma chamada real ao ambiente ocorra — mesmo antes de existir uma tela de execução funcional completa.

**Acceptance Scenarios**:

1. **Given** um ambiente-alvo identificado como homologação autorizada, **When** uma execução funcional é solicitada, **Then** a execução prossegue normalmente.
2. **Given** um ambiente-alvo identificado como produção, **When** uma execução funcional é solicitada, **Then** a execução é bloqueada (`TEST EXECUTION BLOCKED`) antes de qualquer chamada real, e nenhum teste é executado.
3. **Given** um ambiente-alvo que não corresponde a nenhum ambiente conhecido/configurado, **When** uma execução funcional é solicitada, **Then** a execução é bloqueada pelo mesmo motivo — ambiente não reconhecido é tratado como não autorizado, nunca como "autorizado por padrão".

---

### User Story 3 - Execução manual de testes funcionais em homologação (Priority: P2)

Depois que uma demanda é implantada em homologação, um humano pode disparar a execução dos Casos de Teste gerados na User Story 1 contra o ambiente real de homologação — via API e/ou via interface Web — protegida pelo Environment Guard da User Story 2.

O estado `READY_FOR_FUNCTIONAL_TEST` (ver data-model.md) marca formalmente quando uma demanda está implantada em homologação e apta para execução funcional manual.

**Why this priority**: Entrega o valor de validação funcional real, mas depende das duas anteriores já existirem (o que executar, e a garantia de que só executa em homologação).

**Independent Test**: Pode ser totalmente testado, para uma demanda já implantada em homologação com Casos de Teste gerados, disparando a execução funcional e confirmando que cada Caso de Teste selecionado é executado contra o ambiente real e produz um resultado.

**Acceptance Scenarios**:

1. **Given** uma demanda implantada em homologação com Casos de Teste gerados, **When** um humano dispara a execução funcional, **Then** os Casos de Teste marcados como testáveis via API são executados contra a API de homologação.
2. **Given** a mesma demanda, **When** a execução funcional é disparada para os Casos de Teste marcados como testáveis via Web, **Then** eles são executados através da interface da aplicação em homologação (login, navegação, preenchimento, validação de dados/mensagens).
3. **Given** uma demanda cuja implantação em homologação ainda não ocorreu, **When** alguém tenta disparar a execução funcional, **Then** o sistema impede a execução por a demanda não estar no estado apropriado.

---

### User Story 4 - Registro de evidências e histórico de resultados (Priority: P2)

Cada execução de um Caso de Teste funcional produz um registro consultável: o Caso de Teste executado, o ambiente, quando começou/terminou, o resultado (PASS, FAIL, BLOCKED ou NOT_EXECUTED) e evidências quando aplicável (screenshot, vídeo, trace, request/response, logs, status HTTP).

**Why this priority**: Sem isso, a execução da User Story 3 não é auditável nem serve como prova pra decisão de "pronto para produção" — mas só faz sentido depois que existe execução de verdade acontecendo.

**Independent Test**: Pode ser totalmente testado executando um Caso de Teste (User Story 3) e confirmando que o resultado e as evidências aplicáveis ficam disponíveis para consulta depois, associados a essa execução específica.

**Acceptance Scenarios**:

1. **Given** uma execução de teste funcional concluída, **When** alguém consulta o histórico da demanda, **Then** encontra o Caso de Teste, o ambiente, início/fim e o resultado (PASS/FAIL/BLOCKED/NOT_EXECUTED).
2. **Given** uma execução via Web que falhou, **When** alguém consulta essa execução, **Then** encontra evidência (ao menos um screenshot ou trace) associada ao momento da falha.
3. **Given** uma demanda com pelo menos uma execução funcional em FAIL, **When** alguém consulta se a demanda está pronta para produção, **Then** o sistema não a apresenta como pronta.

---

### User Story 5 - Configuração explícita para habilitar execução automática no futuro (Priority: P3)

Existe uma configuração equivalente a `TEST_EXECUTION_ENABLED` (desabilitada por padrão) que controla se a execução de testes pode acontecer automaticamente como parte do pipeline. Enquanto desabilitada, o pipeline gera, armazena e disponibiliza os Casos de Teste, mas nunca os executa sozinho. Habilitar essa configuração é uma ação explícita, não uma consequência de outra mudança.

**Why this priority**: É puramente preparatório para uma evolução futura (execução automática) — não entrega valor imediato por si só nesta versão, já que a execução continua manual (User Story 3) de qualquer forma.

**Independent Test**: Pode ser totalmente testado confirmando que, com a configuração no valor padrão (desabilitada), nenhuma execução acontece sozinha mesmo após geração de Casos de Teste e implantação em homologação — e que alterar essa configuração exige uma ação de configuração explícita, não um efeito colateral de outra tela.

**Acceptance Scenarios**:

1. **Given** a configuração no valor padrão, **When** uma demanda é implementada, testada em Casos de Teste gerados e implantada em homologação, **Then** nenhuma execução funcional acontece automaticamente em nenhum desses passos.
2. **Given** a configuração alterada explicitamente para habilitada, **When** as condições futuras de execução automática forem atendidas, **Then** o sistema pode executar automaticamente — comportamento fora do escopo desta versão além de existir a configuração e ela ser respeitada.

---

### Edge Cases

- O que acontece se o Agente QA não conseguir identificar nenhum cenário de teste relevante pra uma implementação muito pequena (ex.: só um ajuste de texto)? O sistema deve registrar isso explicitamente (não silenciosamente pular a etapa), em vez de bloquear o restante do fluxo.
- O que acontece se a implantação em homologação ocorrer, mas os Casos de Teste da demanda nunca tiverem sido gerados (ex.: demanda antiga, anterior a esta feature)? A execução funcional deve informar que não há Casos de Teste disponíveis, em vez de falhar silenciosamente.
- O que acontece se as credenciais/configuração do ambiente de homologação estiverem incompletas no momento da execução? O Environment Guard deve tratar isso como ambiente não autorizado (bloquear), não como "assumir homologação por padrão".
- O que acontece se uma execução funcional for interrompida no meio (timeout, falha de rede)? Deve ficar registrada com um resultado (BLOCKED ou FAIL, nunca ficar "presa" sem resultado nenhum).
- O que acontece se o arquivo de configuração de ambiente do Projeto (`project-environments/<projectId>.json`) não existir (Projeto nunca configurado) ou estiver malformado/ilegível? O Environment Guard deve tratar da mesma forma que credenciais incompletas — ambiente não autorizado, execução bloqueada — nunca "homologação por padrão".
- O que acontece se uma demanda com Casos de Teste já gerados for reaberta e reimplementada? Os Casos de Teste da versão anterior não devem ser apresentados como válidos para a nova implementação sem que a geração seja refeita para a versão atual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE acionar automaticamente um Agente QA assim que a implementação de uma demanda pelo Developer Agent for concluída.
- **FR-002**: O Agente QA DEVE analisar `spec.md`, `plan.md`, requisitos, critérios de aceite, regras de negócio, as alterações realizadas pelo Developer Agent (diff) e a estrutura da aplicação para gerar os Casos de Teste da demanda.
- **FR-003**: A geração de Casos de Teste DEVE ser obrigatória no fluxo — uma demanda implementada não pode avançar para Commit sem que a geração tenha sido tentada (mesmo que resulte em nenhum caso relevante, ver Edge Cases). O sistema DEVE bloquear o avanço da demanda para Commit caso a geração falhe genuinamente (erro técnico) — mesmo comportamento do Test Gate já existente para testes de unidade. A ausência de cenários aplicáveis (ex.: mudança muito pequena) não é uma falha e não bloqueia o Commit.
- **FR-004**: A geração de Casos de Teste NÃO DEVE, por si só, executar nenhum teste.
- **FR-005**: Os Casos de Teste gerados DEVEM cobrir, quando aplicável à implementação: cenários positivos, cenários negativos, cenários de autorização, cenários de autenticação, cenários de integração (banco, filas, serviços externos, storage, gateways, webhooks) e cenários de regressão sobre funcionalidade existente potencialmente afetada.
- **FR-006**: Cada Caso de Teste DEVE ser registrado de forma independente da tecnologia de execução — título, pré-condições, dados de entrada, passos e resultado esperado — permitindo que o mesmo Caso de Teste seja executado depois por diferentes executores (Web, API). Outros tipos de executor ficam fora do escopo desta versão, sujeitos a extensão futura via Provider Abstraction.
- **FR-007**: O sistema DEVE suportar Casos de Teste dos tipos: unitário, API e interface/Web (UI), além do tipo funcional — usado quando o cenário valida a demanda como um todo, combinando múltiplas camadas, e não se enquadra unicamente como um teste de UI ou de API isolado (ver data-model.md para os valores formais do campo `type`).
- **FR-008**: O sistema DEVE ter uma configuração explícita **por Projeto** (padrão desabilitada) que controla se a execução automática de testes pode ocorrer como parte do pipeline desse Projeto; enquanto desabilitada, testes são gerados, armazenados e disponibilizados, mas nunca executados automaticamente. Mesmo nível já usado por `Project.requiredTestSuites`.
- **FR-009**: A alteração dessa configuração DEVE ser uma ação explícita e distinta de qualquer outra mudança no sistema.
- **FR-010**: Após a implantação de uma demanda em homologação, o sistema DEVE permitir que um usuário com a permissão dedicada `QA_EXECUTE` dispare a execução dos Casos de Teste funcionais dessa demanda contra o ambiente real de homologação.
- **FR-011**: A execução funcional DEVE suportar Casos de Teste executáveis via API (validando status HTTP, payload, headers, autenticação, autorização, regras de negócio e persistência quando aplicável) e via interface Web (login, navegação, preenchimento de formulários, cliques, validação de mensagens e dados).
- **FR-012**: Antes de qualquer execução funcional, o sistema DEVE validar tecnicamente se o ambiente-alvo é um ambiente de homologação autorizado (identificação do ambiente, URLs de aplicação/API, banco, filas, storage, serviços externos, gateways, credenciais).
- **FR-013**: Se o ambiente-alvo for identificado como produção, ou não for reconhecido como autorizado, o sistema DEVE bloquear a execução antes de qualquer chamada real acontecer — essa validação DEVE ser uma verificação técnica, nunca depender exclusivamente de uma decisão da IA.
- **FR-014**: Cada execução de Caso de Teste funcional DEVE produzir um registro com: o Caso de Teste, o ambiente, início, fim, resultado (PASS, FAIL, BLOCKED ou NOT_EXECUTED) e evidências quando aplicável (screenshot, vídeo, trace, request, response, logs, status HTTP).
- **FR-015**: Uma demanda com pelo menos um resultado de teste funcional em FAIL NÃO DEVE ser apresentada como pronta para produção.
- **FR-016**: O sistema NÃO DEVE permitir que a execução funcional automática — controlada pela mesma configuração por Projeto definida em FR-008 —, quando futuramente habilitada, avance sozinha para produção; a aprovação humana para produção permanece obrigatória em qualquer cenário.
- **FR-017**: Evidências que possam conter dados reais de clientes (capturadas em ambiente de homologação) DEVEM seguir a mesma política de proteção de dados já aplicada pela plataforma a informações sensíveis (Princípio V da Constituição — LGPD) — acesso restrito a `QA_READ`/`QA_EXECUTE`, sem exposição pública.
- **FR-018**: O Agente QA DEVE ser implementado como um novo tipo de Agent da plataforma (`Agent.type = "qa"`), com estágio próprio no pipeline de execução — não como uma extensão do Developer Agent existente.

### Key Entities *(este recurso envolve dados)*

- **Caso de Teste**: um cenário de teste gerado pelo Agente QA para uma demanda — título, tipo (unitário/API/UI/funcional, ver FR-007), categoria de cenário (lista canônica em FR-005), pré-condições, dados, passos e resultado esperado. Independente de tecnologia de execução.
- **Execução de Teste Funcional**: uma execução real de um Caso de Teste contra um ambiente (hoje, sempre homologação) — vincula o Caso de Teste, o ambiente, início/fim e o resultado.
- **Evidência**: artefato produzido por uma Execução de Teste Funcional (screenshot, vídeo, trace, request/response, logs, status HTTP), associado a essa execução.
- **Configuração de Execução Automática**: flag **por Projeto** (mesmo nível de `Project.requiredTestSuites`) que determina se execuções automáticas podem ocorrer como parte do pipeline desse Projeto (padrão: desabilitada).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Toda demanda cuja implementação é concluída pelo Developer Agent passa a ter Casos de Teste disponíveis para consulta sem exigir nenhuma ação manual adicional.
- **SC-002**: Nenhuma execução de teste ocorre de forma automática enquanto a configuração de execução automática estiver no valor padrão (desabilitada).
- **SC-003**: 100% das tentativas de execução funcional contra um ambiente identificado como produção, ou não reconhecido, são bloqueadas antes de qualquer chamada real ao ambiente acontecer.
- **SC-004**: Toda execução de teste funcional concluída produz um resultado consultável (PASS/FAIL/BLOCKED/NOT_EXECUTED), com evidências disponíveis quando aplicável.
- **SC-005**: Nenhuma demanda com teste funcional em FAIL é apresentada como pronta para produção.

## Assumptions

- A execução de testes funcionais em homologação, nesta primeira versão, é sempre disparada manualmente por um humano — não existe gatilho automático imediatamente após o deploy (`READY_FOR_FUNCTIONAL_TEST` é um estado que aguarda ação humana, não um evento que dispara execução sozinho).
- "Agente QA" segue o mesmo padrão já usado para os agentes `developer`/`specification_copilot` existentes (ver FR-018).
- O Environment Guard reaproveita, na medida do possível, o conceito de configuração de ambiente por projeto já existente na plataforma (`project-environments/*.json`) em vez de introduzir um mecanismo de identificação de ambiente paralelo.
- A automação completa dos estados de negócio listados no documento de origem (avançar sozinho de PR aprovado para GMUD, de GMUD para deploy, etc.) está fora do escopo desta feature — esses passos já são disparados manualmente hoje na plataforma (GMUD, Pull Request) e continuam assim; esta feature adiciona os estados/etapas de QA e teste funcional ao ciclo, sem automatizar as transições que já são manuais.
- A execução de testes de unidade continua sendo responsabilidade do que já existe na plataforma (`TestRunnerService`, disparado manualmente); esta feature não substitui isso, cobre a camada de Casos de Teste funcionais/QA gerados pelo novo Agente QA.
