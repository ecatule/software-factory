# Data Model: Gestão de Sistemas, Artefatos e Especificação Assistida sem IA direta

Todas as tabelas novas seguem os campos obrigatórios da constituição: `id` (UUID),
`stAtivo`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy`, `updatedBy`, `version`
(omitidos abaixo por brevidade — presentes em todas). Nenhuma exclusão física em nenhuma
tabela (FR-022).

## New: `System`

Representa uma aplicação/produto existente da organização (User Story 1).

| Campo | Tipo | Regras |
|---|---|---|
| `name` | String | obrigatório |
| `description` | String? | opcional |

Relacionamentos: `artifacts` (`SystemArtifact[]`), `clients` (via `ClientSystem`), `demands`
(via `DemandSystem`).

## New: `SystemArtifact`

Unidade técnica pertencente a um único Sistema (User Story 1).

| Campo | Tipo | Regras |
|---|---|---|
| `systemId` | UUID (FK → System) | obrigatório |
| `name` | String | obrigatório |
| `type` | String | obrigatório; texto livre, lista sugerida na UI (Tela, API, Serviço, Worker, Banco de Dados, Microserviço, Biblioteca, Componente, Outro) — sem enum fechado (Assumptions) |
| `technology` | String? | opcional |
| `description` | String? | opcional |

Regra: não permitir criar um `SystemArtifact` com `stAtivo: true` vinculado a um `System`
com `stAtivo: false` (FR-003) — validado no service, não só no schema.

## New: `ClientSystem`

Associação N:N entre Cliente e Sistema (User Story 2).

| Campo | Tipo | Regras |
|---|---|---|
| `clientId` | UUID (FK → Client) | obrigatório |
| `systemId` | UUID (FK → System) | obrigatório |

`@@unique([clientId, systemId])` — impede duplicidade lógica mesmo com soft-remove/upsert
(FR-005). Regra: não permitir associar um `System` com `stAtivo: false` (FR-004 do
documento técnico original).

## New: `DemandSystem`

Sistemas selecionados como envolvidos na especificação de uma demanda (User Story 3).

| Campo | Tipo | Regras |
|---|---|---|
| `demandId` | UUID (FK → Demand) | obrigatório |
| `systemId` | UUID (FK → System) | obrigatório |

`@@unique([demandId, systemId])`. Regra (validada no service, não só no schema): o `System`
selecionado MUST estar associado (via `ClientSystem` ativo) ao `Client` da demanda
(FR-013).

## New: `DemandSystemArtifact`

Artefatos selecionados, dentro dos Sistemas selecionados, para a especificação de uma
demanda (User Story 3).

| Campo | Tipo | Regras |
|---|---|---|
| `demandId` | UUID (FK → Demand) | obrigatório |
| `systemArtifactId` | UUID (FK → SystemArtifact) | obrigatório |

`@@unique([demandId, systemArtifactId])`. Regra (validada no service): o `SystemArtifact`
selecionado MUST pertencer a um `System` presente em `DemandSystem` (ativo) para essa
mesma demanda (FR-012) — rejeitar com 422/400 caso contrário, mesmo que a requisição venha
direto da API sem passar pela UI (SC-006).

## Unchanged (referenciadas, não alteradas)

- **`Client`**: ganha a relação reversa `systems` (via `ClientSystem`) — nenhum campo novo.
- **`Demand`**: ganha as relações reversas `selectedSystems` (via `DemandSystem`) e
  `selectedSystemArtifacts` (via `DemandSystemArtifact`) — `projectId` e todo o resto
  permanecem exatamente como estão (Clarifications).
- **`Project`/`Artifact`/`ArtifactFile`**: sem nenhuma alteração de schema — feature
  001-004 continuam funcionando sem modificação.

## Novo conceito derivado (não persistido): Prompt SPEC

Não é uma tabela — é o resultado de uma operação stateless, montado a partir de:
`Demand` (título, descrição) + `Client` do `Demand` + `DemandSystem`/`DemandSystemArtifact`
ativos + o template `apps/api/prompts/prompt-spec-kit.md` + as **informações de negócio e
insumos técnicos enviadas no corpo da própria requisição** (`business`/`technical`, texto
livre) — mesmo padrão já usado hoje por `sendToAi()`/`POST /executions`
(`SpecificationWorkspace.tsx`), que também não lê esses textos de nenhuma tabela: o
frontend já os tem em memória no momento em que o analista aciona a ação. FR-024
("regenerar refletindo o estado mais atual") é satisfeito trivialmente por isso — cada
clique em "Gerar Prompt SPEC" reenvia o conteúdo atual das textareas, sem exigir nenhuma
nova coluna de persistência de rascunho.
