# Feature Specification: Gestão de Sistemas, Artefatos e Especificação Assistida sem IA direta

**Feature Branch**: `[005-system-catalog-spec-prompt]`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Gestão de Sistemas, Artefatos e Especificação Assistida sem chamada direta de IA — evolução da AI Software Factory (features 001-004 já implementadas). Documentos de origem: `documentos iniciais/3.Alteração da Software Factory — Gestão de Sistemas, Artefatos e Especificação Assistida.md` (spec funcional) e `documentos iniciais/3.Plano de Implementação — Gestão de Sistemas, Artefatos e SPEC.md` (plano técnico complementar), mais o template `documentos iniciais/prompt-spec-kit.md`. Cadastro de Sistemas e seus Artefatos como catálogo técnico reutilizável; associação Cliente×Sistema N:N; seleção de Sistemas/Artefatos na Especificação Assistida — SPEC restrita ao Cliente da demanda; remoção do botão 'Enviar para IA' (nenhuma chamada direta a LLM nesta funcionalidade); nova ação 'Gerar Prompt SPEC' que consolida as informações da demanda no template versionado e permite copiar o resultado para colar manualmente em qualquer IA."

## Clarifications

### Session 2026-08-10

- Q: Quando o Developer Agent descobre, durante a implementação automatizada, um artefato técnico ainda não cadastrado no catálogo — o que deve acontecer com ele? → A: É criado automaticamente no catálogo do Sistema da demanda e já marcado como selecionado para essa demanda (preserva o comportamento visível de hoje, sem passo manual).
- Q: Sistema/Artefato devem ser implementados reaproveitando as entidades `Project`/`Artifact` já existentes, ou como entidades novas e independentes? → A: Entidades novas e independentes, sem depender de nenhuma linha de `Project` existente. Motivo concreto identificado durante a clarificação: um mesmo sistema real (ex. "Vexur") hoje é representado por **múltiplas linhas separadas de `Project`, uma por Cliente** (porque `Project.clientId` sempre foi N:1) — reaproveitar `Project` como Sistema exigiria consolidar manualmente essas duplicatas ou aceitar duplicação de catálogo de Artefatos por cliente, o que contraria o objetivo de catálogo único e reutilizável. `Project` continua existindo exatamente como está hoje (branch/ambiente/tecnologias, ligado 1:N a Client) — sem nenhuma relação obrigatória com Sistema nesta feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar Sistemas e seus Artefatos (Priority: P1)

Um administrador cadastra um Sistema (ex: "Vexur") representando uma aplicação existente da organização, e cadastra os Artefatos técnicos que pertencem a esse Sistema (ex: uma Tela, uma API), formando um catálogo técnico reutilizável — não amarrado a nenhuma demanda específica.

**Why this priority**: É a base de dados sobre a qual todo o resto da feature funciona — sem Sistemas e Artefatos cadastrados, não há o que selecionar na Especificação Assistida nem o que incluir no Prompt SPEC.

**Independent Test**: Pode ser totalmente testado cadastrando um Sistema, cadastrando um ou mais Artefatos dentro dele, e confirmando que ambos aparecem na listagem — sem depender de nenhuma demanda ou cliente.

**Acceptance Scenarios**:

1. **Given** a tela de Sistemas, **When** o administrador informa nome e descrição e salva, **Then** o Sistema passa a existir e aparece na listagem como ativo.
2. **Given** um Sistema existente, **When** o administrador cadastra um Artefato informando nome, tipo, tecnologia e descrição, **Then** o Artefato passa a existir vinculado a esse Sistema.
3. **Given** um Sistema ou Artefato existente, **When** o administrador o inativa, **Then** ele deixa de aparecer nas listagens padrão e nas seleções disponíveis, mas permanece no histórico de qualquer demanda que já o tenha selecionado.
4. **Given** um Sistema inativo, **When** o administrador tenta cadastrar um novo Artefato ativo nele, **Then** o sistema impede a operação.

---

### User Story 2 - Associar Sistemas a Clientes (Priority: P1)

Um administrador associa um ou mais Sistemas a um Cliente, e um mesmo Sistema pode ser associado a mais de um Cliente — relação muitos-para-muitos.

**Why this priority**: É o que restringe quais Sistemas cada Cliente pode usar em suas demandas (User Story 3) — sem essa associação, a Especificação Assistida não tem como filtrar o que mostrar.

**Independent Test**: Pode ser totalmente testado associando um Sistema a um Cliente e confirmando que a associação aparece na tela do Cliente, sem depender de nenhuma demanda.

**Acceptance Scenarios**:

1. **Given** um Cliente e um Sistema ativo, **When** o administrador associa o Sistema ao Cliente, **Then** o Sistema passa a aparecer na lista de Sistemas desse Cliente.
2. **Given** um Sistema já associado a um Cliente, **When** o administrador tenta associá-lo novamente, **Then** o sistema rejeita a duplicidade.
3. **Given** um Sistema associado a um Cliente, **When** o administrador remove a associação, **Then** o Sistema deixa de aparecer para esse Cliente, mas nem o Sistema nem o Cliente são excluídos fisicamente.
4. **Given** um Sistema inativo, **When** o administrador tenta associá-lo a um Cliente, **Then** o sistema impede a operação.

---

### User Story 3 - Selecionar Sistemas e Artefatos na Especificação Assistida (Priority: P2)

Um analista, ao especificar uma demanda, seleciona quais Sistemas do Cliente da demanda estão envolvidos e, para cada Sistema selecionado, quais dos seus Artefatos ativos serão trabalhados.

**Why this priority**: É o que conecta o catálogo (User Stories 1-2) à demanda real — entrega valor assim que existir, mesmo antes de qualquer geração de prompt (User Story 4).

**Independent Test**: Pode ser totalmente testado abrindo a Especificação Assistida de uma demanda de um Cliente com Sistemas associados, selecionando Sistemas e Artefatos, e confirmando que a seleção é salva e reaparece ao reabrir a tela.

**Acceptance Scenarios**:

1. **Given** um Cliente com Sistemas associados, **When** o analista abre a Especificação Assistida de uma demanda desse Cliente, **Then** somente os Sistemas associados a esse Cliente ficam disponíveis para seleção.
2. **Given** um Cliente sem nenhum Sistema associado, **When** o analista abre a Especificação Assistida, **Then** nenhum Sistema é oferecido para seleção.
3. **Given** um Sistema selecionado, **When** o analista visualiza os Artefatos disponíveis, **Then** somente os Artefatos ativos desse Sistema são exibidos.
4. **Given** múltiplos Sistemas do Cliente, **When** o analista seleciona mais de um, **Then** o sistema permite e mantém a seleção de todos.
5. **Given** uma seleção de Sistemas/Artefatos já salva, **When** o analista reabre a Especificação Assistida em outro momento, **Then** a seleção anterior é exibida sem precisar ser refeita.
6. **Given** uma tentativa de selecionar um Artefato de um Sistema não selecionado para a demanda, **When** a operação é enviada, **Then** o backend rejeita, mesmo que o frontend tivesse permitido.

---

### User Story 4 - Gerar e copiar o Prompt SPEC, sem envio direto para IA (Priority: P2)

Um analista, após preencher as informações de negócio e os insumos técnicos e selecionar os Sistemas/Artefatos envolvidos, aciona "Gerar Prompt SPEC" para obter um prompt completo e estruturado, pronto para colar manualmente em qualquer IA de sua preferência — a Software Factory não realiza nenhuma chamada a uma API de LLM nessa etapa.

**Why this priority**: É o valor final da funcionalidade, mas depende inteiramente da User Story 3 já estar disponível (precisa dos Sistemas/Artefatos selecionados) — por isso vem depois na prioridade, mesmo sendo o objetivo principal do documento de origem.

**Independent Test**: Pode ser totalmente testado preenchendo informações de negócio e insumos técnicos, com Sistemas/Artefatos já selecionados (User Story 3), acionando "Gerar Prompt SPEC" e confirmando que o conteúdo gerado inclui todas essas informações e pode ser copiado — sem que nenhuma chamada de rede para um provedor de IA ocorra.

**Acceptance Scenarios**:

1. **Given** uma demanda com informações de negócio, insumos técnicos, Sistemas e Artefatos preenchidos, **When** o analista aciona "Gerar Prompt SPEC", **Then** o sistema exibe um prompt completo contendo essas informações, estruturado a partir do template versionado da Software Factory.
2. **Given** o prompt gerado, **When** o analista aciona "Copiar Prompt", **Then** o conteúdo completo do prompt é copiado para a área de transferência.
3. **Given** a tela de Especificação Assistida, **When** o analista a visualiza, **Then** não existe mais um botão que envie a especificação diretamente para uma IA a partir da Software Factory.
4. **Given** uma demanda cuja seleção de Sistemas/Artefatos ou informações de negócio/técnicas mudou depois de um Prompt já ter sido gerado, **When** o analista aciona "Gerar Prompt SPEC" novamente, **Then** o novo prompt reflete as informações atualizadas.
5. **Given** qualquer geração de Prompt SPEC, **When** a operação é auditada, **Then** não há registro de nenhuma chamada de rede para um provedor de LLM associada a essa geração.

---

### Edge Cases

- O que acontece quando um Cliente não tem nenhum Sistema associado e o analista tenta especificar uma demanda? A tela deve deixar claro que não há Sistemas disponíveis, sem travar o restante do preenchimento.
- O que acontece quando um Sistema selecionado numa demanda é inativado depois? A seleção já feita permanece visível no histórico da demanda; o Sistema só deixa de estar disponível para novas seleções.
- O que acontece se dois Artefatos de nomes iguais existirem em Sistemas diferentes? Ambos podem coexistir — o Artefato é identificado pela combinação com seu Sistema, não pelo nome isolado.
- O que acontece quando o Developer Agent (execução automatizada) identifica, durante a implementação, um artefato técnico ainda não catalogado? Ele deve ser adicionado ao catálogo do Sistema da demanda e automaticamente marcado como selecionado para essa demanda, preservando a rastreabilidade sem exigir cadastro manual prévio.
- O que acontece se o analista tentar gerar o Prompt SPEC sem nenhum Sistema/Artefato selecionado? O sistema gera o prompt mesmo assim, com essas seções vazias — a geração não deve ser bloqueada por isso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir criar, editar e ativar/inativar Sistemas (nome e descrição, nome obrigatório).
- **FR-002**: O sistema MUST permitir criar, editar e ativar/inativar Artefatos vinculados a um Sistema (nome, tipo, tecnologia e descrição; nome e tipo obrigatórios).
- **FR-003**: O sistema MUST impedir a criação de um Artefato ativo vinculado a um Sistema inativo.
- **FR-004**: O sistema MUST permitir associar um ou mais Sistemas ativos a um Cliente, e um mesmo Sistema MUST poder ser associado a mais de um Cliente (relação muitos-para-muitos).
- **FR-005**: O sistema MUST impedir duplicidade de associação entre o mesmo Cliente e o mesmo Sistema.
- **FR-006**: O sistema MUST permitir remover a associação entre um Cliente e um Sistema sem excluir fisicamente nenhum dos dois.
- **FR-007**: Na Especificação Assistida — SPEC, o sistema MUST exibir apenas os Sistemas associados ao Cliente da demanda como opções de seleção.
- **FR-008**: O sistema MUST permitir selecionar múltiplos Sistemas para a especificação de uma demanda.
- **FR-009**: Após um Sistema ser selecionado, o sistema MUST exibir apenas seus Artefatos ativos como opções de seleção.
- **FR-010**: O sistema MUST permitir selecionar múltiplos Artefatos, entre os Sistemas selecionados, para a especificação de uma demanda.
- **FR-011**: O sistema MUST persistir a seleção de Sistemas e Artefatos junto à demanda/especificação, recuperável em acessos futuros sem precisar ser refeita.
- **FR-012**: O sistema MUST rejeitar, no backend, a seleção de um Artefato que não pertença a um Sistema selecionado para aquela demanda, independentemente do que o frontend permitir.
- **FR-013**: O sistema MUST rejeitar, no backend, a seleção de um Sistema não associado ao Cliente da demanda.
- **FR-014**: O sistema MUST oferecer uma ação "Gerar Prompt SPEC" que consolida as informações de negócio, os insumos técnicos, o Cliente, os Sistemas selecionados e os Artefatos selecionados da demanda.
- **FR-015**: A geração do Prompt SPEC MUST usar o template versionado `prompt-spec-kit.md` como base, substituindo seu ponto de entrada pelas informações consolidadas da demanda.
- **FR-016**: O sistema MUST exibir o prompt gerado para visualização antes de qualquer uso.
- **FR-017**: O sistema MUST permitir copiar o conteúdo completo do prompt gerado em uma única ação.
- **FR-018**: O sistema MUST NOT realizar nenhuma chamada direta a uma API de LLM (OpenAI, Anthropic, Google ou qualquer outro provedor) como parte da geração ou exibição do Prompt SPEC.
- **FR-019**: A ação que hoje envia a especificação diretamente para geração automática por IA MUST deixar de estar disponível na tela de Especificação Assistida — SPEC.
- **FR-020**: O sistema MUST registrar auditoria para: criação/alteração/ativação/inativação de Sistema; criação/alteração/ativação/inativação de Artefato; associação/remoção de Cliente×Sistema; alteração da seleção de Sistemas/Artefatos de uma demanda; geração do Prompt SPEC.
- **FR-021**: O sistema MUST restringir, por permissão específica (independente da autenticação genérica), quem pode visualizar, criar, editar e ativar/inativar Sistemas e Artefatos, quem pode alterar a seleção de Sistemas/Artefatos de uma demanda, e quem pode gerar o Prompt SPEC.
- **FR-022**: O sistema MUST NOT excluir fisicamente nenhum Sistema, Artefato ou associação — toda remoção MUST ser lógica (inativação), preservando o histórico.
- **FR-023**: Quando um artefato técnico ainda não catalogado for identificado durante a implementação automatizada de uma demanda, o sistema MUST adicioná-lo ao catálogo do Sistema da demanda e automaticamente selecioná-lo para essa demanda.
- **FR-024**: O sistema MUST permitir regenerar o Prompt SPEC a qualquer momento, refletindo o estado mais atual das informações de negócio, insumos técnicos e seleção de Sistemas/Artefatos.
- **FR-025**: A inativação de um Sistema ou Artefato já selecionado por uma demanda existente MUST NOT remover esse registro do histórico dessa demanda.

### Key Entities *(include if feature involves data)*

- **Sistema**: representa uma aplicação/produto existente da organização (ex: "Vexur"). Possui nome, descrição e status ativo/inativo. Pode estar associado a múltiplos Clientes e possui um catálogo de Artefatos.
- **Artefato**: unidade técnica pertencente a um único Sistema (ex: uma Tela, uma API). Possui nome, tipo, tecnologia, descrição e status ativo/inativo. Existe independentemente de qualquer demanda — é selecionado, não criado, ao ser usado numa especificação (exceto quando descoberto automaticamente durante a implementação, caso em que é criado no catálogo e já selecionado).
- **Associação Cliente×Sistema**: vínculo muitos-para-muitos entre um Cliente e um Sistema, controlando quais Sistemas cada Cliente pode usar em suas demandas.
- **Seleção de Sistemas da Demanda**: registro de quais Sistemas foram escolhidos como envolvidos na especificação de uma demanda específica.
- **Seleção de Artefatos da Demanda**: registro de quais Artefatos, dentro dos Sistemas selecionados, foram escolhidos como envolvidos na especificação de uma demanda específica.
- **Prompt SPEC**: conteúdo textual gerado sob demanda a partir do template versionado e do contexto consolidado da demanda (negócio, técnico, Sistemas, Artefatos) — não é uma entidade persistida por si só, mas um resultado derivável a qualquer momento dos dados acima.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um administrador consegue cadastrar um Sistema e ao menos um Artefato nele em menos de 2 minutos.
- **SC-002**: Um Sistema pode ser associado a mais de um Cliente, e um Cliente pode ter mais de um Sistema associado, sem limite artificial imposto pelo sistema.
- **SC-003**: Na Especificação Assistida, 100% dos Sistemas de Clientes diferentes do da demanda ficam ocultos da seleção.
- **SC-004**: Um analista consegue gerar e copiar o Prompt SPEC de uma demanda já preenchida em menos de 1 minuto.
- **SC-005**: Zero chamadas de rede para um provedor de LLM ocorrem durante a geração ou exibição do Prompt SPEC, verificável por auditoria.
- **SC-006**: 100% das tentativas de selecionar um Artefato fora do Sistema/Cliente correto são bloqueadas pelo backend, mesmo simulando uma requisição direta que ignore o frontend.
- **SC-007**: Um usuário autorizado consegue consultar, a qualquer momento depois, quais Sistemas e Artefatos foram envolvidos em qualquer demanda já especificada.

## Assumptions

- **Sistema e Artefato são entidades novas e independentes** — não reaproveitam `Project`/`Artifact`, já existentes na Software Factory. Motivo (ver Clarifications): um mesmo sistema real hoje pode estar representado por múltiplas linhas separadas de `Project` (uma por Cliente, já que `Project.clientId` sempre foi N:1), o que impediria um catálogo de Sistema/Artefato verdadeiramente único e compartilhável entre Clientes sem uma migração/consolidação manual de dados. `Project` continua existindo exatamente como está (branch/ambiente/tecnologias, ligado 1:N a Client), sem nenhuma relação obrigatória com Sistema nesta feature.
- **`Artifact`/`ArtifactFile` (rastreamento de arquivos alterados por demanda, usado pelo Developer Agent e pela trilha de auditoria de implementação) continuam existindo exatamente como estão, sem relação com o novo catálogo de Artefato/Sistema** — são conceitos distintos que coincidem no nome em português/inglês: `Artifact` rastreia o que foi alterado numa implementação; o novo "Artefato" é um item de catálogo técnico reutilizável, referenciado (não alterado) pela Especificação Assistida. A descoberta automática do Developer Agent (FR-023) alimenta o novo catálogo de Artefato como um registro adicional, sem substituir o rastreamento de `Artifact`/`ArtifactFile` já existente.
- **O botão "Enviar para IA" e o fluxo automatizado de geração via IA que hoje existem permanecem no código-fonte**, apenas deixando de estar disponíveis/visíveis na tela de Especificação Assistida — não é uma remoção física do código, preservando reversibilidade.
- **O template `prompt-spec-kit.md` é versionado no próprio repositório** (não em banco de dados), sendo tratado como parte da configuração da Software Factory — alterações nele seguem o mesmo processo de versionamento do restante do código.
- **O tipo do Artefato é um campo de texto livre** (não uma lista fixa fechada), para permitir evolução dos tipos ao longo do tempo, com uma lista sugerida inicial (Tela, API, Serviço, Worker, Banco de Dados, Microserviço, Biblioteca, Componente, Outro).
- **O formulário de criação manual de `Artifact` vinculado a uma demanda, já existente (feature 004 User Story 6), continua existindo sem alteração** — é uma funcionalidade diferente (rastreamento de arquivos por demanda), não o novo catálogo de Sistema/Artefato desta feature. A UI desta feature MUST usar rótulos/nomenclatura que deixem clara a distinção para o analista (ex.: "Sistemas" para o catálogo novo), evitando confundir as duas telas.
- **A seleção de Sistemas/Artefatos de uma demanda permanece editável independentemente do status de aprovação da especificação** — não há bloqueio de imutabilidade nessa seleção (diferente das versões de especificação já aprovadas, que continuam imutáveis como hoje).
