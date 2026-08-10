# Research: Gestão de Sistemas, Artefatos e Especificação Assistida sem IA direta

## 1. Nomenclatura das novas entidades

**Decision**: `System` e `SystemArtifact` (inglês, consistente com o resto do schema:
`Project`, `Repository`, `Provider`). Rótulos de UI em português ("Sistemas"/"Artefatos"),
mesmo padrão já usado no resto do app (identificadores em inglês, textos visíveis em
português/mistos).

**Rationale**: evita colidir com o `Artifact` já existente (rastreamento de arquivos por
demanda, usado pelo Developer Agent) — nomear a nova entidade `Artifact` também criaria
ambiguidade grave no código (dois modelos Prisma quase-homônimos) e nos imports/tipos
TypeScript. `SystemArtifact` deixa a relação de posse (pertence a um `System`) explícita
já no nome, e não exige nenhum prefixo/sufixo estranho ao restante do domínio.

**Alternatives considered**: `CatalogSystem`/`CatalogArtifact` — descartado por ser mais
verboso sem ganho de clareza; `Sistema`/`Artefato` (nomes em português no schema) —
descartado por quebrar a convenção 100% inglês já estabelecida em todas as tabelas
existentes (`Client`, `Demand`, `Specification`, etc.).

## 2. Associações N:N e soft-delete

**Decision**: quatro tabelas associativas novas — `ClientSystem`, `DemandSystem`,
`DemandSystemArtifact` — todas com `stAtivo` e chave composta única
(`@@id([...])`/`@@unique([...])`), seguindo exatamente o padrão já corrigido nesta sessão
para `ProjectTechnology` (feature 003) e `RolePermission` (feature 004, finding G1 do
`/speckit.analyze`): nunca `deleteMany` (bloqueado platform-wide pelo
`softDeleteGuardExtension`, mesmo em join tables sem outras colunas de auditoria) — toda
remoção/alteração de seleção usa soft-remove (`stAtivo: false`) + upsert dentro de uma
`$transaction`.

**Rationale**: é o único padrão já validado ao vivo neste projeto para join tables sob a
constituição (soft delete obrigatório, "Mandatory table fields" incluem `st_ativo` até em
tabelas puramente associativas). Reinventar um padrão diferente aqui introduziria
inconsistência sem benefício.

**Alternatives considered**: usar uma coluna `removedAt` separada de `stAtivo` só nessas
tabelas — descartado, sem motivo para divergir do padrão único já em uso em todo o schema.

## 3. Nomes de permissão

**Decision**: `SYSTEM_READ`, `SYSTEM_WRITE`, `SYSTEM_ARTIFACT_READ`, `SYSTEM_ARTIFACT_WRITE`,
`DEMAND_SYSTEM_WRITE` (edita a seleção de Sistemas/Artefatos de uma demanda — reaproveita o
verbo `WRITE` já usado em `DEMAND_WRITE`/`SPECIFICATION_WRITE`), `SPEC_PROMPT_GENERATE`
(gera o Prompt SPEC).

**Rationale**: segue exatamente a convenção já estabelecida na feature 004
(`DEMAND_READ/WRITE`, `SPECIFICATION_WRITE/APPROVE`, `AUDIT_READ`) — verbo em inglês,
maiúsculas, sujeito+ação. O documento de origem sugeria nomes em português
(`SISTEMA_VISUALIZAR` etc.) mas isso quebraria a convenção 100%-inglês já em produção no
catálogo de permissões (`PERMISSION_CATALOG` em `prisma/seed.ts`).

**Alternatives considered**: `SYSTEM_ACTIVATE`/`SYSTEM_DEACTIVATE` como permissões
separadas de `SYSTEM_WRITE` — descartado por granularidade excessiva sem pedido explícito
no spec; ativar/inativar fica coberto por `SYSTEM_WRITE`, mesmo padrão de
`DEMAND_WRITE` cobrindo create/update hoje.

## 4. Onde o template `prompt-spec-kit.md` vive em runtime

**Decision**: copiado para `apps/api/prompts/prompt-spec-kit.md` (novo diretório), lido do
disco pelo backend a cada geração (sem cache — arquivo pequeno, leitura barata). O arquivo
de origem em `documentos iniciais/` permanece como documento de referência do produto, não
como fonte em runtime — evita acoplar o processo do worker/API a um caminho fora de
`apps/api/`.

**Rationale**: `apps/api/dist/` já é o artefato de deploy (`nest build`); manter o template
dentro de `apps/api/` garante que ele viaje junto no build/deploy sem configuração extra de
path. Mantém DA02 do documento técnico ("prompt versionado no repositório").

**Alternatives considered**: ler diretamente de `documentos iniciais/` — descartado,
acopla o runtime a uma pasta de documentação que pode não existir/ser copiada em um
ambiente de deploy real; usar uma variável de ambiente apontando o path — descartado por
complexidade desnecessária para um arquivo estático versionado.

## 5. Como "esconder" o fluxo de IA sem remover o código

**Decision**: nenhuma flag de configuração nova — a UI simplesmente deixa de renderizar o
botão "Enviar para IA"/painel de proposta em `SpecificationWorkspace.tsx` (código
comentado/condicional removido do JSX ativo, mas os hooks/serviços/endpoints por trás
continuam existindo e podem ser re-habilitados revertendo essa parte específica do
componente). Backend não muda nada — `POST /executions` com `specification_copilot`
continua funcionando se chamado diretamente (ex. via `Agents.tsx`, já existente), só não é
mais alcançável a partir da tela de SPEC.

**Rationale**: mais simples que introduzir uma feature flag/config nova só para isso —
reversão é um diff de frontend pequeno e claro, sem precisar de infraestrutura de flags que
o projeto não tem hoje.

**Alternatives considered**: flag de ambiente (`ENABLE_AI_SPEC_ROUND=false`) lida no
backend para bloquear o endpoint — descartado por ser mais infraestrutura do que o pedido
exige (FR-019 é sobre a tela, não sobre desabilitar a capability inteira no backend).

## 6. Descoberta automática do Developer Agent (FR-023)

**Decision**: `DeveloperAgentService` (já estende com `ensureRepositoriesCloned`/
`recordImplementationFiles` desta sessão) ganha um novo método
`ensureSystemArtifactCataloged(demandId, artifactName, artifactType)`, chamado quando um
arquivo é registrado como `DISCOVERED` em `recordImplementationFiles` — resolve o `System`
associado à demanda via `DemandSystem` (o primeiro Sistema selecionado, ou cria uma entrada
"Sistema não classificado" só quando a demanda não tem nenhum Sistema selecionado ainda —
caso raro, tratado como edge case), faz upsert de um `SystemArtifact` (por nome dentro do
Sistema) e um `DemandSystemArtifact` (soft-remove+upsert, marcado `stAtivo: true`).

**Rationale**: reaproveita exatamente o ponto de entrada já existente (arquivo descoberto
durante `implement`) confirmado no `/speckit.clarify` — sem precisar de um novo gatilho.

**Alternatives considered**: catalogar no nível do `Artifact` (existente) em vez de criar
um `SystemArtifact` — rejeitado explicitamente na clarificação (são conceitos diferentes).

## 7. Endpoints REST

**Decision**: espelhar exatamente os padrões já em uso — `paginate()` para listagens
(`GET /systems`, `GET /systems/:id/artifacts`), `RequirePermission` por endpoint,
`PUT` idempotente para seleção completa (`PUT /demands/:id/systems`,
`PUT /demands/:id/system-artifacts`, mesmo padrão de `PUT /roles/:id/permissions`),
`POST /demands/:id/prompt-spec` (ação de processamento, não um recurso persistido) — mesma
justificativa de `POST` vs `GET` já usada para `POST /executions`.

**Rationale**: zero padrões novos a aprender; todo o resto do time (e o próprio Developer
Agent) já reconhece essas convenções.
