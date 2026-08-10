# Feature Specification: AI-Assisted Specification & Increments

**Feature Branch**: `003-ai-assisted-specification`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Incremento de especificações e desenvolvimento assistido por IA (feature 003) para a AI Software Factory, construído sobre o backend e console web já existentes (features 001-ai-software-factory e 002-web-console). Este incremento cobre exclusivamente três capacidades de negócio hoje ausentes — não deve re-especificar Clientes, Projetos, Demandas, Dashboard, Cockpit, Artefatos ou Auditoria, que já existem e continuam como estão: (1) Catálogo de Tecnologias; (2) Incremento de Demanda; (3) Especificação Assistida por IA (a capacidade central). Fora de escopo: reestruturação do Cockpit em abas, novos indicadores no Dashboard, novas colunas/filtros em Demandas, importação do Monday, RBAC granular, campos de ambiente/branch em Projeto e Repositório, criação manual de Artefato."

## Clarifications

### Session 2026-08-09

- Q: A chamada à IA para gerar a proposta deve bloquear a tela até a resposta chegar, ou deve rodar em segundo plano (como já acontece com as execuções de agente hoje) enquanto o analista acompanha o status? → A: Assíncrono via fila (BullMQ) — mesmo padrão já usado pelo Developer Agent; o analista envia o pedido, acompanha o status de processamento, e a tela é atualizada quando a proposta chega, sem bloquear a navegação.
- Q: (adicionado pelo usuário, fora da fila de perguntas) A tela de Especificação Assistida deve oferecer, além do fluxo conversacional com a IA, uma opção alternativa de anexar arquivos `.md` já prontos vindos de outra fonte, sem passar pelo copiloto? → A: Sim — o analista pode optar por subir os arquivos `specify.md`/`plan.md` diretamente como uma nova versão de rascunho, pulando a rodada de IA, e esse rascunho segue as mesmas regras de comparação/aprovação/imutabilidade das demais versões (FR-007 a FR-013).
- Q: Quem pode aprovar uma versão de especificação — qualquer usuário autenticado envolvido na demanda, ou apenas usuários com um papel/role específico? → A: Qualquer usuário autenticado pode aprovar — sem restrição adicional de role além da autenticação já exigida hoje.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerar e aprovar uma especificação com ajuda de um copiloto de IA (Priority: P1)

Um analista, ao trabalhar a especificação de uma demanda, informa o que precisa ser feito (problema, objetivo, contexto, regras de negócio conhecidas, fluxos conhecidos, critérios de aceite, restrições) e o que já sabe do lado técnico (telas/APIs/serviços/componentes/banco envolvidos, repositórios, observações técnicas). Ele envia essas informações para a IA configurada e recebe de volta uma proposta estruturada de especificação (requisitos de negócio, regras, critérios de aceite, fluxos, requisitos técnicos, artefatos identificados, riscos, perguntas em aberto) e um rascunho dos documentos `specify.md` e `plan.md`. O analista revisa, pode pedir uma nova rodada de análise à IA, editar diretamente, comparar rascunhos entre si, e só ele decide aprovar a versão final — a IA nunca aprova em seu nome.

**Why this priority**: É a capacidade central deste incremento e o principal motivo de ele existir — hoje o analista só tem um editor Markdown manual, sem nenhuma assistência de IA, apesar da infraestrutura de chamada a LLM já existir e não ser usada. Entrega valor sozinha, mesmo antes de qualquer outra capacidade deste incremento existir.

**Independent Test**: Pode ser testado integralmente abrindo a especificação de uma demanda existente, preenchendo as informações de negócio/técnicas, enviando para a IA, recebendo uma proposta, iterando pelo menos uma vez, e aprovando uma versão — sem depender do catálogo de Tecnologias nem da criação de um segundo incremento.

**Acceptance Scenarios**:

1. **Given** uma demanda sem nenhuma especificação aprovada ainda, **When** o analista preenche as informações de negócio e técnicas e envia para a IA, **Then** o sistema monta o contexto da demanda (cliente, projeto, artefatos conhecidos, histórico relevante) e retorna uma proposta estruturada com um rascunho de `specify.md` e `plan.md`.
2. **Given** uma proposta de rascunho já recebida, **When** o analista solicita uma nova rodada de análise informando um ajuste, **Then** o sistema gera uma nova versão de rascunho sem apagar a versão anterior, e o analista consegue comparar as duas.
3. **Given** um rascunho que o analista considera pronto, **When** ele aprova essa versão, **Then** o sistema registra quem aprovou, quando, qual versão e um comentário opcional; gera/atualiza os documentos `specify.md` e `plan.md` armazenados; e essa versão nunca mais pode ser sobrescrita.
4. **Given** uma versão já aprovada, **When** qualquer novo ajuste é necessário, **Then** o sistema cria uma nova versão em vez de alterar a versão aprovada existente.
5. **Given** uma proposta recebida da IA, **When** o analista prefere não aceitá-la, **Then** ele consegue rejeitar a proposta e/ou editar o conteúdo diretamente, sem ser obrigado a aceitar a sugestão da IA.
6. **Given** o analista já possui arquivos `specify.md`/`plan.md` prontos de outra origem, **When** ele opta por anexá-los em vez de usar o copiloto, **Then** o sistema cria uma nova versão de rascunho a partir desses arquivos, sem exigir nenhuma rodada de IA, e essa versão segue as mesmas regras de comparação, aprovação e imutabilidade das versões geradas por IA.

---

### User Story 2 - Catalogar tecnologias e associá-las a um projeto (Priority: P2)

Um analista cadastra as tecnologias usadas pela fábrica (nome, categoria, versão, descrição, status) e associa uma ou mais delas a cada projeto. As tecnologias associadas a um projeto passam a fazer parte automaticamente do contexto enviado à IA quando uma demanda desse projeto é especificada (User Story 1), para que a proposta gerada já considere a stack real do projeto.

**Why this priority**: Melhora diretamente a qualidade das propostas da User Story 1, mas a User Story 1 já funciona (com contexto de tecnologia vazio) sem esta capacidade — por isso vem depois, não junto.

**Independent Test**: Pode ser testado cadastrando tecnologias, associando-as a um projeto, e conferindo que a lista de tecnologias do projeto reflete a associação — sem depender de nenhuma demanda estar em processo de especificação.

**Acceptance Scenarios**:

1. **Given** o catálogo de tecnologias, **When** o analista cadastra uma nova tecnologia com nome, categoria, versão, descrição e status, **Then** ela passa a existir no catálogo e pode ser associada a qualquer projeto.
2. **Given** um projeto e uma ou mais tecnologias cadastradas, **When** o analista associa essas tecnologias ao projeto, **Then** a lista de tecnologias do projeto passa a refletir essa associação (um projeto pode ter várias tecnologias).
3. **Given** um projeto com tecnologias associadas, **When** uma demanda desse projeto é enviada para a IA (User Story 1), **Then** as tecnologias do projeto aparecem automaticamente no contexto enviado, sem o analista precisar reinformá-las.

---

### User Story 3 - Criar um novo incremento numa demanda existente (Priority: P3)

Depois que uma demanda já tem uma especificação aprovada (e possivelmente já foi desenvolvida), o analista identifica uma necessidade nova ou um ajuste (ex: "durante o teste foi identificado que o cancelamento precisa registrar o motivo") e cria um novo incremento nessa demanda, descrevendo o motivo. O sistema leva para a IA a especificação e o plano atualmente aprovados, mais essa nova informação, mais o contexto do projeto/tecnologias/artefatos, e a IA sugere as alterações necessárias — destacando o que muda: regras adicionadas, artefatos impactados, APIs impactadas, dados impactados, novos testes sugeridos. Cada incremento mantém sua própria evolução de especificação e plano, sem nunca sobrescrever o incremento anterior.

**Why this priority**: Depende de uma especificação já aprovada existir (User Story 1) para fazer sentido — é a extensão do fluxo central para o caso de "a demanda já foi especificada uma vez e agora precisa evoluir", por isso vem por último.

**Independent Test**: Pode ser testado numa demanda que já tem uma especificação aprovada (via User Story 1): criar um novo incremento informando um motivo, e confirmar que a IA recebe a especificação/plano aprovados como ponto de partida e retorna um resumo do que muda, sem alterar o incremento anterior.

**Acceptance Scenarios**:

1. **Given** uma demanda com uma especificação aprovada em um incremento anterior, **When** o analista cria um novo incremento informando o motivo, **Then** o sistema inicia uma nova rodada de especificação assistida (User Story 1) partindo da especificação e do plano aprovados anteriormente, sem alterá-los.
2. **Given** um novo incremento em andamento, **When** a IA analisa a nova informação junto do histórico aprovado, **Then** o sistema apresenta um resumo do que muda: regras adicionadas, artefatos impactados, APIs impactadas, dados impactados, e testes adicionais sugeridos.
3. **Given** uma demanda com múltiplos incrementos, **When** o analista consulta o histórico da demanda, **Then** cada incremento continua acessível com sua própria evolução de especificação e plano, preservados na íntegra.

---

### Edge Cases

- O que acontece se o provedor de IA configurado falhar ou ficar indisponível no meio de uma rodada de análise? O sistema deve preservar as informações já digitadas pelo analista e permitir tentar novamente, sem perda de dados.
- O que acontece se o analista tentar aprovar uma versão enquanto uma nova rodada de análise da IA ainda está em andamento para a mesma especificação? O sistema deve impedir a aprovação de uma versão que não é mais a mais recente sem uma confirmação explícita.
- O que acontece se o analista editar diretamente a proposta da IA em vez de pedir uma nova rodada? A edição deve gerar uma nova versão de rascunho igualmente rastreável, distinguindo o que veio da IA do que foi alterado por humano.
- O que acontece ao criar um incremento numa demanda cuja especificação do incremento anterior ainda não foi aprovada? O sistema deve impedir ou alertar, já que não há uma base aprovada da qual partir.
- O que acontece se um projeto não tiver nenhuma tecnologia associada? A especificação assistida (User Story 1) deve funcionar normalmente, apenas sem essa seção de contexto.
- O que acontece se duas pessoas tentarem editar/enviar a especificação da mesma demanda ao mesmo tempo? A versão mais recente deve prevalecer de forma rastreável, sem perder silenciosamente o trabalho de nenhuma das duas.
- O que acontece se o analista tentar anexar um arquivo que não é um Markdown válido, está vazio, ou não é um dos dois documentos esperados (`specify.md`/`plan.md`)? O sistema deve rejeitar o upload com uma mensagem clara, sem criar uma versão de rascunho inválida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que o analista informe, para a especificação de uma demanda, um conjunto de informações de negócio: o que precisa ser feito, problema atual, objetivo, contexto, regras de negócio conhecidas, fluxos conhecidos, critérios de aceite, restrições e observações.
- **FR-002**: O sistema MUST permitir que o analista informe insumos técnicos conhecidos: telas, APIs, serviços, componentes, banco/estruturas envolvidas, repositórios e observações técnicas.
- **FR-003**: O sistema MUST montar um contexto único para a IA antes de qualquer chamada, composto por: dados da demanda, cliente, projeto, tecnologias do projeto (quando existirem), repositórios, artefatos conhecidos, incremento atual, especificação e plano previamente aprovados (quando existirem), histórico relevante, e as informações de negócio/técnicas informadas pelo analista.
- **FR-004**: O sistema MUST enviar esse contexto para o provedor de IA configurado e MUST manter esse provedor substituível (não pode haver acoplamento direto a um fornecedor específico de LLM no domínio/core).
- **FR-005**: O sistema MUST apresentar a resposta da IA de forma estruturada, incluindo pelo menos: resumo, requisitos de negócio, regras de negócio, critérios de aceite, fluxos, requisitos técnicos, artefatos identificados/sugeridos, riscos, perguntas em aberto, e o conteúdo proposto para `specify.md` e `plan.md`.
- **FR-006**: O sistema MUST permitir que o analista solicite uma nova rodada de análise à IA (fluxo iterativo, não uma chamada única), informando ajustes ou pedidos de complemento/correção/revisão/identificação de lacunas.
- **FR-007**: Cada rodada de análise da IA MUST gerar uma nova versão de rascunho, preservando as versões anteriores para consulta e comparação.
- **FR-008**: O sistema MUST permitir que o analista compare (diff) duas versões de uma especificação antes de decidir.
- **FR-009**: O sistema MUST permitir que o analista aceite, rejeite, ou edite diretamente qualquer proposta gerada pela IA.
- **FR-010**: Somente um usuário humano autenticado MUST poder aprovar uma versão de especificação — qualquer usuário autenticado pode fazê-lo, sem exigir um role adicional além da autenticação já exigida hoje pela plataforma; o sistema MUST NUNCA aprovar uma versão automaticamente em nome do analista.
- **FR-011**: Uma vez aprovada, uma versão de especificação MUST NUNCA ser sobrescrita; qualquer alteração posterior MUST gerar uma nova versão.
- **FR-012**: O sistema MUST registrar cada aprovação com usuário responsável, data/hora, versão aprovada e comentário opcional, e esse registro MUST ser consultável (auditável).
- **FR-013**: Ao aprovar uma versão, o sistema MUST gerar/atualizar os documentos `specify.md` e `plan.md` armazenados e versionados para aquela demanda/incremento.
- **FR-014**: O sistema MUST permitir que o analista cadastre tecnologias com nome, categoria, versão, descrição e status.
- **FR-015**: O sistema MUST permitir associar uma ou mais tecnologias cadastradas a um projeto (relação muitos-para-muitos).
- **FR-016**: As tecnologias associadas ao projeto de uma demanda MUST ser automaticamente incluídas no contexto montado para a IA (FR-003), sem exigir reentrada manual pelo analista.
- **FR-017**: O sistema MUST permitir que o analista crie um novo incremento em uma demanda existente, informando um motivo/descrição da alteração identificada.
- **FR-018**: O sistema MUST impedir a criação de um novo incremento quando o incremento atual da demanda ainda não possui uma especificação aprovada.
- **FR-019**: Ao criar um novo incremento, o sistema MUST montar o contexto da IA (FR-003) usando a especificação e o plano atualmente aprovados como ponto de partida, mais a nova informação do analista.
- **FR-020**: Para um novo incremento, o sistema MUST apresentar ao analista um resumo do impacto identificado pela IA: regras adicionadas, artefatos impactados, APIs impactadas, dados impactados e testes adicionais sugeridos.
- **FR-021**: Cada incremento de uma demanda MUST manter sua própria evolução de especificação e plano, sem que a criação de um novo incremento altere ou remova o histórico de um incremento anterior.
- **FR-022**: Cada interação com a IA (cada rodada de análise) MUST ser rastreável (registrando o que foi enviado e o que foi recebido), de forma consistente com a auditoria já exigida para o restante da plataforma.
- **FR-023**: Cada rodada de análise da IA MUST ser processada de forma assíncrona (segundo plano), reaproveitando o mecanismo de fila de execução já usado pelo Developer Agent, sem bloquear a interface do analista; o analista MUST poder acompanhar o status do processamento (pendente/em andamento/concluído/falhou) e continuar navegando enquanto aguarda.
- **FR-024**: O sistema MUST oferecer, como alternativa ao fluxo conversacional com a IA, uma opção para o analista anexar/subir arquivos `specify.md` e `plan.md` já prontos de outra origem diretamente na tela de Especificação Assistida.
- **FR-025**: Uma versão de especificação criada por upload direto (FR-024) MUST seguir exatamente as mesmas regras de versionamento, comparação, aprovação e imutabilidade (FR-007 a FR-013) que uma versão gerada pela IA — a única diferença é a origem do conteúdo, não o ciclo de vida da versão.

### Key Entities *(include if feature involves data)*

- **Technology**: representa uma tecnologia usada por um ou mais projetos (ex: Vue 2, Node.js, PostgreSQL). Atributos: nome, categoria, versão, descrição, status. Relaciona-se com Project em N:N.
- **Increment**: representa uma evolução independente dentro de uma mesma Demand (ex: incremento 1 = implementação original, incremento 2 = ajuste pós-homologação). Possui um número sequencial, motivo/descrição, status, e referência à versão de especificação aprovada da qual partiu (quando aplicável). Uma Demand tem um incremento atual.
- **Specification Version (estendida)**: a versão imutável de uma especificação já existe hoje; este incremento adiciona a ela: a qual Increment pertence, seu status no ciclo de vida (rascunho / gerada / em revisão / aprovada / rejeitada / superada), origem (gerada por IA / editada por humano / anexada via upload de arquivo pronto), e metadados de aprovação (quem aprovou, quando, comentário).
- **AI Specification Round**: representa uma rodada de interação entre o analista e a IA dentro do processo de especificação de um incremento — o que foi enviado como contexto/pedido e o que a IA retornou como proposta estruturada. Cada rodada gera uma nova versão de rascunho e fica registrada para rastreabilidade.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um analista consegue enviar as informações de negócio e técnicas em uma única submissão e obter um rascunho completo de especificação, acompanhando o status do processamento em segundo plano sem precisar sair da tela de especificação nem ter a navegação bloqueada.
- **SC-002**: 100% das versões de especificação aprovadas permanecem inalteradas após a aprovação — nenhuma operação do sistema consegue sobrescrever uma versão já aprovada.
- **SC-003**: 100% das aprovações de versão ficam registradas com usuário, data/hora, versão e são consultáveis posteriormente.
- **SC-004**: Ao criar um novo incremento, o analista consegue visualizar o resumo do impacto (regras/artefatos/APIs/dados/testes) sem precisar reler manualmente a especificação completa anterior.
- **SC-005**: Tecnologias associadas a um projeto aparecem no contexto enviado à IA em 100% das análises feitas para demandas desse projeto, sem reentrada manual.
- **SC-006**: Um analista consegue comparar duas versões quaisquer de uma especificação e identificar visualmente as diferenças sem sair da tela de especificação.
- **SC-007**: Nenhum incremento anterior perde ou tem alterado seu histórico de especificação quando um novo incremento é criado na mesma demanda.

## Assumptions

- O incremento #1 de uma demanda é criado implicitamente junto com a própria demanda (a demanda sempre tem um incremento "atual" desde o início); a ação explícita de "criar incremento" (User Story 3) se aplica a partir do 2º incremento em diante.
- A "conversa" com a IA é um fluxo iterativo de rodadas (enviar informação/pedido → receber proposta atualizada), não necessariamente uma interface de chat com histórico de mensagens estilo bate-papo — qualquer uma das duas apresentações visuais satisfaz os requisitos funcionais aqui descritos.
- O provedor de LLM real (ex: ChatGPT) pode não estar configurado com credenciais em todos os ambientes; a construção completa do fluxo e das telas não depende de uma chave de API real estar presente — a validação ao vivo de ponta a ponta fica condicionada à disponibilidade de credenciais, seguindo o mesmo padrão já estabelecido nas features 001 e 002 deste projeto.
- Edição manual direta do conteúdo (sem passar pela IA) continua sempre disponível como alternativa, reaproveitando a experiência de edição já existente da tela de Especificação atual.
- Concorrência entre analistas na mesma especificação é resolvida por controle de versão otimista (campo `version`) já exigido pela constituição do projeto para todas as tabelas — não é necessário lock exclusivo.
- Ficam fora deste incremento (deferidos para uma feature futura): reestruturação do Cockpit em abas, novos indicadores/gráficos no Dashboard, novas colunas/filtros na lista de Demandas, importação de demanda do Monday, permissões RBAC granulares (o sistema continua usando os roles já existentes), campos de ambiente/branch de homologação em Projeto e Repositório, e criação manual de Artefato pela tela de Artefatos.
- As telas e fluxos já existentes (Clientes, Projetos, Demandas, Dashboard, Cockpit, Artefatos, Auditoria) permanecem como estão — este incremento não os re-especifica, apenas os estende onde explicitamente indicado (ex: Projeto passa a ter tecnologias associadas).
