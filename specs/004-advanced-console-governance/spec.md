# Feature Specification: Advanced Console & Governance

**Feature Branch**: `004-advanced-console-governance`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Console administrativo avançado e governança (feature 004) para a AI Software Factory. Cobre as seis capacidades explicitamente deferidas na feature 003 (spec.md Assumptions): (1) campos de ambiente/branch em Projeto e Repositório; (2) permissões RBAC granulares; (3) Dashboard mais rico; (4) lista de Demandas enriquecida + importação Monday; (5) Cockpit da Demanda em abas; (6) criação manual de Artefato. Não re-especificar o que já existe: Clientes, Tecnologias, Incrementos, Especificação Assistida, Login."

## Clarifications

### Session 2026-08-09

- Q: Quando um usuário não tem a permissão necessária para uma ação, o botão dessa ação deve ficar oculto/desabilitado na tela, ou deve continuar visível e só ser rejeitado pelo backend ao clicar? → A: Esconder/desabilitar no frontend E rejeitar no backend (defesa em profundidade) — mesmo padrão já usado na tela de Settings (feature 002), inacessível "dos dois lados".
- Q: As abas do Cockpit devem ser linkáveis via URL (compartilhar/voltar direto numa aba específica), ou o estado da aba é só de memória, resetando para "Resumo" a cada recarregamento? → A: Linkável via URL — usa o React Router já presente no projeto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar branches e ambientes de um projeto e seus repositórios (Priority: P1)

Um responsável técnico, ao configurar um projeto, informa o branch de produção e o branch de homologação do projeto, além de uma descrição/URL do ambiente de homologação e do ambiente de produção. Para cada repositório vinculado ao projeto, ele também pode informar o branch de produção e de homologação específicos daquele repositório (podem divergir do branch geral do projeto, já que um projeto pode ter múltiplos repositórios). Essas informações passam a alimentar automaticamente a seção "Branch de Origem" da tela de Especificação Assistida, que hoje é só um lembrete de preenchimento manual.

**Why this priority**: Resolve uma lacuna já identificada e sentida em uso real — sem isso, o "Branch de Origem" nunca tem de onde vir, e o preenchimento continua manual.

**Independent Test**: Cadastrar os branches/ambientes de um projeto e de um repositório existente, e confirmar que os valores ficam salvos e visíveis, e que a tela de Especificação Assistida os usa como sugestão automática — sem depender de nenhuma das outras cinco capacidades desta feature.

**Acceptance Scenarios**:

1. **Given** um projeto existente, **When** o responsável técnico informa branch de produção, branch de homologação, ambiente de homologação e ambiente de produção, **Then** esses valores ficam salvos e visíveis na tela do projeto.
2. **Given** um repositório vinculado a um projeto, **When** o responsável técnico informa o branch de produção e de homologação daquele repositório, **Then** esses valores ficam salvos e visíveis, independentemente dos valores gerais do projeto.
3. **Given** um projeto com branch de produção cadastrado, **When** o analista abre a Especificação Assistida de uma demanda desse projeto, **Then** a seção "Branch de Origem" já vem preenchida automaticamente, sem exigir digitação manual.

---

### User Story 2 - Restringir ações sensíveis por permissão específica (Priority: P1)

Um administrador atribui permissões específicas (não apenas o role genérico "admin") às roles existentes. O sistema passa a checar a permissão exata necessária antes de autorizar uma ação sensível — por exemplo, aprovar uma versão de especificação passa a exigir a permissão `SPECIFICATION_APPROVE`, não apenas estar autenticado. Um usuário autenticado mas sem a permissão necessária recebe uma mensagem clara de que lhe falta autorização, não apenas um erro genérico.

**Why this priority**: É a base de governança que sustenta o resto do console — sem isso, qualquer usuário autenticado pode aprovar especificações, executar agentes, ou disparar operações Git, o que não é aceitável para um ambiente com múltiplos usuários.

**Independent Test**: Atribuir uma única permissão (ex: `SPECIFICATION_APPROVE`) a um role de teste, autenticar um usuário sem essa permissão, e confirmar que a ação relevante é bloqueada com uma mensagem clara — sem depender de nenhuma das outras capacidades desta feature.

**Acceptance Scenarios**:

1. **Given** um catálogo de permissões (`DEMAND_READ`, `DEMAND_WRITE`, `SPECIFICATION_WRITE`, `SPECIFICATION_APPROVE`, `AGENT_EXECUTE`, `GIT_WRITE`, `PR_CREATE`, `AUDIT_READ`), **When** um administrador associa uma permissão a um role, **Then** todo usuário com esse role passa a ter essa permissão.
2. **Given** um usuário autenticado sem a permissão `SPECIFICATION_APPROVE`, **When** ele tenta aprovar uma versão de especificação, **Then** o sistema rejeita a ação com uma mensagem explicando que falta essa permissão específica, não apenas "não autorizado".
3. **Given** um usuário com a permissão correta, **When** ele realiza a ação protegida por ela, **Then** a ação é autorizada normalmente.
4. **Given** o comportamento já existente de administradores (role "admin"), **When** este incremento é implantado, **Then** nenhum administrador perde acesso a nada que já podia fazer antes (todas as permissões são concedidas ao role admin por padrão).

---

### User Story 3 - Visão gerencial mais completa no Dashboard (Priority: P2)

Um gestor abre o Dashboard e vê, além da contagem por estágio já existente: total de demandas, quantas estão abertas, em especificação, em desenvolvimento e bloqueadas; quantas Pull Requests estão abertas; quantos testes estão falhando; quantos agentes estão em execução; a distribuição de demandas por cliente; e o tempo médio gasto em cada etapa do workflow. Cada um desses indicadores permite clicar e ver diretamente as demandas relacionadas àquele número.

**Why this priority**: Depois da governança (US1/US2), é o que mais aumenta o valor percebido do console no dia a dia de quem acompanha a operação.

**Independent Test**: Abrir o Dashboard com dados reais no sistema e confirmar que cada indicador novo aparece com o valor correto e que clicar nele leva à lista de demandas filtrada correspondente — sem depender de nenhuma outra capacidade desta feature.

**Acceptance Scenarios**:

1. **Given** demandas em diferentes status e estágios, **When** o gestor abre o Dashboard, **Then** ele vê contagens corretas de demandas totais, abertas, em especificação, em desenvolvimento e bloqueadas.
2. **Given** Pull Requests e testes registrados no sistema, **When** o gestor abre o Dashboard, **Then** ele vê quantas PRs estão abertas e quantos testes estão falhando no momento.
3. **Given** demandas de múltiplos clientes, **When** o gestor abre o Dashboard, **Then** ele vê a distribuição de demandas por cliente.
4. **Given** qualquer um dos indicadores acima, **When** o gestor clica nele, **Then** ele é levado à lista de demandas já filtrada pelo critério daquele indicador.

---

### User Story 4 - Encontrar e importar demandas mais facilmente (Priority: P2)

Um analista, na tela de Demandas, agora vê colunas de cliente, projeto, prioridade, incremento atual, agente atual, PR e última atualização — e consegue filtrar por cliente, projeto, tipo, prioridade, agente, período e PR. Quando uma demanda já existe em um registrador externo (Monday.com) mas ainda não foi trazida para a fábrica, o analista consegue importá-la informando o identificador externo, sem precisar redigitar manualmente os dados que já existem lá.

**Why this priority**: Junto com o Dashboard, é o que mais melhora o uso diário da tela mais visitada do console.

**Independent Test**: Aplicar cada filtro novo isoladamente e confirmar que a lista reflete corretamente; separadamente, importar uma demanda por identificador externo do Monday e confirmar que ela aparece na lista com os dados corretos — sem depender de nenhuma outra capacidade desta feature.

**Acceptance Scenarios**:

1. **Given** demandas de diferentes clientes, projetos, prioridades e agentes, **When** o analista aplica um filtro (isoladamente ou combinado), **Then** a lista mostra apenas as demandas que atendem a esse filtro.
2. **Given** a lista de demandas, **When** o analista a visualiza, **Then** as colunas de cliente, projeto, prioridade, incremento atual, agente atual, PR e última atualização estão visíveis.
3. **Given** uma demanda existente no Monday mas não importada ainda, **When** o analista informa o identificador externo e confirma a importação, **Then** uma nova demanda é criada na fábrica com os dados vindos do Monday.
4. **Given** uma demanda já importada anteriormente (mesma origem + identificador externo), **When** o analista tenta importar o mesmo identificador de novo, **Then** o sistema rejeita a duplicidade (comportamento de reimportação já garantido desde a feature 001, reaproveitado aqui).

---

### User Story 5 - Navegar o Cockpit da demanda por abas (Priority: P3)

Um analista, ao abrir o Cockpit de uma demanda com muito histórico acumulado (várias especificações, artefatos, incrementos, atividade de Git), navega por abas — Resumo, Especificação, Artefatos, Tarefas, Desenvolvimento, Testes, Git, Linha do tempo, Auditoria — em vez de rolar uma página única com tudo empilhado.

**Why this priority**: É uma melhoria de organização/usabilidade sobre informação que já existe e já é exibida hoje — sem risco de perda de dado, mas também sem criar capacidade nova, por isso vem depois das três anteriores.

**Independent Test**: Abrir o Cockpit de uma demanda com dados em várias das abas, e confirmar que cada aba mostra exatamente a informação que a versão em página única já mostrava, sem duplicar chamadas nem perder nenhuma seção — sem depender de nenhuma outra capacidade desta feature.

**Acceptance Scenarios**:

1. **Given** o Cockpit de uma demanda, **When** o analista alterna entre abas, **Then** cada aba mostra o conteúdo correspondente (Resumo, Especificação, Artefatos, Desenvolvimento, Testes, Git, Linha do tempo, Auditoria) sem recarregar a página inteira.
2. **Given** uma demanda com incrementos, artefatos, especificações e atividade de Git já registrados, **When** o analista visita cada aba relevante, **Then** nenhuma informação que existia na página única anterior deixa de aparecer em alguma aba.
3. **Given** a aba "Tarefas", **When** o analista a visualiza numa demanda que ainda não tem controle de tarefas granular implementado, **Then** a aba explica claramente que essa capacidade ainda não está disponível, em vez de mostrar um erro ou tela em branco sem explicação.
4. **Given** o link de uma aba específica do Cockpit (ex: a aba "Git" de uma demanda), **When** esse link é aberto diretamente (compartilhado ou recarregado), **Then** o Cockpit abre já naquela aba, não em "Resumo".

---

### User Story 6 - Cadastrar um artefato conhecido manualmente (Priority: P4)

Um analista, ao especificar uma demanda, já sabe de antemão que uma tela ou API específica será impactada — antes mesmo de qualquer análise automática. Ele cadastra esse artefato manualmente na tela de Artefatos (tipo, nome, descrição, repositório, path, tecnologia), em vez de esperar que ele seja descoberto automaticamente mais tarde.

**Why this priority**: É a menor e mais isolada das seis capacidades — melhora a completude dos insumos técnicos, mas o sistema já funciona sem ela (os artefatos descobertos automaticamente continuam funcionando normalmente).

**Independent Test**: Cadastrar manualmente um artefato numa demanda existente, e confirmar que ele aparece na lista de artefatos da demanda junto com os descobertos automaticamente — sem depender de nenhuma outra capacidade desta feature.

**Acceptance Scenarios**:

1. **Given** uma demanda existente, **When** o analista cadastra manualmente um artefato informando tipo, nome, descrição, repositório, path e tecnologia, **Then** o artefato passa a existir e aparece na lista de artefatos da demanda.
2. **Given** uma demanda com artefatos manuais e descobertos automaticamente, **When** o analista visualiza a lista, **Then** ambos aparecem juntos, sem exigir uma tela separada.

---

### Edge Cases

- O que acontece se um projeto tiver múltiplos repositórios com branches de homologação/produção diferentes entre si e diferentes do branch geral do projeto? A Especificação Assistida deve conseguir mostrar a origem correta por repositório, não só um valor único ambíguo por projeto.
- O que acontece se uma permissão necessária para uma ação for removida de um role enquanto um usuário com sessão ativa já está usando o sistema? A próxima chamada relevante deve ser bloqueada — a permissão é sempre checada na hora da ação, nunca apenas no login.
- O que acontece se o Monday retornar um identificador que não existe mais (removido/inacessível) durante uma importação? O sistema deve informar claramente que a importação falhou, sem criar uma demanda incompleta.
- O que acontece se duas abas do Cockpit dependerem do mesmo dado (ex: Especificação e Resumo)? O dado deve ser buscado uma única vez e reaproveitado entre as abas, não duplicado por chamada.
- O que acontece se um indicador do Dashboard não tiver nenhuma demanda correspondente (ex: zero PRs abertas)? Deve mostrar zero claramente, não ocultar o indicador nem gerar erro.
- O que acontece se o analista tentar cadastrar manualmente um artefato com o mesmo nome/path de um já existente na mesma demanda? O sistema deve alertar sobre a possível duplicidade, mas não é obrigado a impedir (pode haver casos legítimos de nomes repetidos entre demandas diferentes).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir cadastrar branch de produção, branch de homologação, ambiente de homologação e ambiente de produção em um Projeto.
- **FR-002**: O sistema MUST permitir cadastrar branch de produção e branch de homologação em um Repositório, independentemente dos valores gerais do Projeto ao qual pertence.
- **FR-003**: A tela de Especificação Assistida MUST usar os branches cadastrados (do repositório relevante, quando existir, ou do projeto como alternativa) para preencher automaticamente a seção "Branch de Origem" dos insumos técnicos.
- **FR-004**: O sistema MUST manter um catálogo de permissões: `DEMAND_READ`, `DEMAND_WRITE`, `SPECIFICATION_WRITE`, `SPECIFICATION_APPROVE`, `AGENT_EXECUTE`, `GIT_WRITE`, `PR_CREATE`, `AUDIT_READ`.
- **FR-005**: O sistema MUST permitir que um administrador associe permissões específicas a roles.
- **FR-006**: O sistema MUST checar a permissão específica (não apenas autenticação genérica) antes de autorizar: aprovar uma versão de especificação (`SPECIFICATION_APPROVE`), criar/editar uma versão de especificação (`SPECIFICATION_WRITE`), disparar a execução de um agente (`AGENT_EXECUTE`), operações de escrita em Git — branch/commit/push/PR (`GIT_WRITE`, `PR_CREATE`), leitura/escrita de demandas (`DEMAND_READ`/`DEMAND_WRITE`), e leitura do log de auditoria (`AUDIT_READ`).
- **FR-007**: O sistema MUST rejeitar uma ação protegida por permissão com uma mensagem clara indicando qual permissão específica está faltando, quando o usuário autenticado não a possui.
- **FR-007a**: A interface MUST esconder ou desabilitar qualquer botão/ação protegida por uma permissão que o usuário autenticado não possui, além da rejeição já exigida por FR-007 no backend (defesa em profundidade, mesmo padrão já usado pela tela de Settings desde a feature 002 — Clarifications 2026-08-09).
- **FR-008**: O sistema MUST conceder todas as permissões do catálogo ao role `admin` por padrão, para que nenhum administrador perca acesso já existente com a introdução deste controle.
- **FR-009**: O Dashboard MUST exibir: total de demandas, demandas abertas, em especificação, em desenvolvimento, bloqueadas, Pull Requests abertas, testes falhando, e agentes em execução.
- **FR-010**: O Dashboard MUST exibir a distribuição de demandas por cliente.
- **FR-011**: O Dashboard MUST exibir o tempo médio gasto em cada etapa do workflow.
- **FR-012**: Cada indicador do Dashboard MUST permitir navegar diretamente para a lista de demandas filtrada correspondente.
- **FR-013**: A lista de Demandas MUST exibir as colunas cliente, projeto, prioridade, incremento atual, agente atual, PR e última atualização.
- **FR-014**: A lista de Demandas MUST permitir filtrar por cliente, projeto, tipo, prioridade, agente, período e PR, além dos filtros já existentes.
- **FR-015**: O sistema MUST permitir importar uma demanda a partir de um identificador de um registrador externo (Monday.com), reaproveitando a integração já existente sem acoplar a UI diretamente ao Monday.
- **FR-016**: O sistema MUST rejeitar a importação de uma demanda cujo (origem, identificador externo) já foi importado antes, consistente com a regra já existente desde a feature 001.
- **FR-017**: O Cockpit da Demanda MUST ser organizado em abas: Resumo, Especificação, Artefatos, Tarefas, Desenvolvimento, Testes, Git, Linha do tempo, Auditoria.
- **FR-018**: Cada aba do Cockpit MUST mostrar exatamente a informação que já existe hoje na página única, sem omitir nenhuma seção atual.
- **FR-019**: A troca de abas no Cockpit MUST NOT recarregar a página inteira nem refazer chamadas de dados já obtidos na mesma visita.
- **FR-019a**: A aba ativa do Cockpit MUST ser refletida na URL, permitindo copiar/compartilhar um link direto para uma aba específica e voltar a ela ao recarregar a página (Clarifications 2026-08-09).
- **FR-020**: O sistema MUST permitir que o analista cadastre manualmente um Artefato (tipo, nome, descrição, repositório, path, tecnologia) para uma demanda.
- **FR-021**: Artefatos cadastrados manualmente MUST aparecer na mesma lista dos artefatos descobertos automaticamente, sem exigir uma tela separada.

### Key Entities *(include if feature involves data)*

- **Project (estendido)**: ganha branch de produção, branch de homologação, ambiente de homologação e ambiente de produção.
- **Repository (estendido)**: ganha branch de produção e branch de homologação próprios.
- **Permission (reaproveitada)**: já existe como conceito na plataforma (usada hoje só para uma permissão administrativa genérica); passa a ter um catálogo fixo de valores específicos e a ser checada em pontos concretos do sistema.
- **RolePermission (reaproveitada)**: associação já existente entre Role e Permission, agora efetivamente usada para múltiplas permissões por role.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um responsável técnico consegue cadastrar os branches/ambientes de um projeto e de um repositório em uma única visita à respectiva tela, sem precisar de suporte técnico.
- **SC-002**: 100% das aberturas da Especificação Assistida para demandas de projetos com branch cadastrado mostram o "Branch de Origem" já preenchido, sem digitação manual.
- **SC-003**: 100% das tentativas de ação protegida por uma permissão específica, feitas por um usuário sem essa permissão, são bloqueadas — nenhuma ação sensível fica acessível apenas por autenticação genérica.
- **SC-004**: Nenhum usuário com o role `admin` perde acesso a qualquer ação que já podia realizar antes deste incremento.
- **SC-005**: Um gestor consegue ver todos os novos indicadores do Dashboard e navegar até as demandas relacionadas a qualquer um deles em no máximo 2 cliques.
- **SC-006**: Um analista consegue localizar uma demanda específica usando os filtros novos (cliente/projeto/prioridade/agente/período/PR) sem precisar rolar manualmente por todas as demandas.
- **SC-007**: Uma demanda existente no Monday consegue ser importada para a fábrica em uma única ação, sem redigitação manual dos dados de origem.
- **SC-008**: Um analista consegue encontrar qualquer informação do Cockpit que já existia antes (nenhuma perda de dado) navegando pelas abas, sem depender de rolagem de página única.
- **SC-009**: Um analista consegue cadastrar um artefato conhecido manualmente e vê-lo refletido na lista de artefatos da demanda imediatamente após salvar.

## Assumptions

- A aba "Tarefas" do Cockpit não corresponde a uma nova entidade de controle de tarefas granular (isso não faz parte do catálogo de módulos já implementado); ela existe como espaço reservado, explicando claramente a ausência dessa capacidade ainda, e pode futuramente passar a mostrar as tasks geradas pelo pipeline SDD quando esse rastreamento existir.
- "Ambiente de homologação" e "ambiente de produção" são tratados como texto livre (descrição/URL), não como uma integração ativa com o ambiente real (não é necessário checar automaticamente se o ambiente está no ar).
- A importação de demanda do Monday reaproveita o `DemandProvider` já implementado desde a feature 001 (apenas nunca exposto por uma ação de UI) — este incremento não modifica a integração em si, só adiciona o ponto de entrada na interface.
- As permissões granulares (User Story 2) coexistem com o controle por role já existente — não removem nem substituem o mecanismo de `@Roles()` usado hoje (ex: a tela de Settings continua exigindo o role `admin`), apenas adicionam uma camada mais fina onde especificado nos requisitos funcionais acima.
- Ficam fora deste incremento (não fazem parte de nenhuma das seis capacidades acima): qualquer mudança nas telas/fluxos de Clientes, Tecnologias, Incrementos, Especificação Assistida (além do consumo do branch de origem, FR-003) e Login/autenticação, que permanecem como estão.
