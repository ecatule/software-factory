# Implementation Plan: Gestão de Sistemas, Artefatos e Especificação Assistida sem IA direta

**Branch**: `005-system-catalog-spec-prompt` | **Date**: 2026-08-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-system-catalog-spec-prompt/spec.md`

## Summary

Introduz um catálogo técnico reutilizável (`System`/`SystemArtifact`) independente das
entidades `Project`/`Artifact` já existentes, associável a múltiplos Clientes (N:N). A
Especificação Assistida — SPEC passa a permitir selecionar Sistemas (restritos ao Cliente
da demanda) e seus Artefatos, persistindo essa seleção. Uma nova ação "Gerar Prompt SPEC"
consolida negócio + insumos técnicos + Cliente + Sistemas/Artefatos selecionados dentro do
template versionado `prompt-spec-kit.md` — sem nenhuma chamada a LLM. O fluxo de IA
existente (specification_copilot / "Modo B") fica oculto na UI, não removido do código.

## Technical Context

**Language/Version**: TypeScript (NestJS no backend, React+Vite no frontend) — mesmo stack
de 001-004, nenhuma dependência nova.

**Primary Dependencies**: Prisma/PostgreSQL, class-validator, TanStack Query/Table,
react-hook-form — todas já usadas no monorepo.

**Storage**: PostgreSQL (Supabase, mesma instância já usada nesta sessão).

**Testing**: Nenhum framework de teste automatizado configurado ainda no monorepo
(consistente com 001-004) — validação por `tsc`/`eslint`/`build` + validação manual ao
vivo contra o Postgres real, documentada em `quickstart.md` e `tasks.md`.

**Target Platform**: Web (mesma arquitetura já existente).

**Project Type**: Web application (monorepo `apps/api` + `apps/web`, já estabelecido).

**Performance Goals**: Sem meta nova além do já vigente (paginação padrão do projeto,
`paginate()` com teto de 100 itens por página).

**Constraints**: Nenhuma chamada de rede para provedor de LLM na geração/exibição do Prompt
SPEC (FR-018, SC-005) — restrição funcional, não de performance.

**Scale/Scope**: Mesma escala das features anteriores — catálogo técnico de porte
organizacional (dezenas a centenas de Sistemas/Artefatos), não volume de big data.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|---|---|
| I. AI Agent Boundary | PASS — a geração do Prompt SPEC não envolve nenhum agente de IA; é montagem de texto no backend a partir de dados já validados. O fluxo de IA existente (specification_copilot) continua respeitando o princípio como já respeitava. |
| II. Provider Abstraction | PASS — nenhum provedor novo introduzido. A leitura do template `prompt-spec-kit.md` é acesso a arquivo local versionado, não uma integração externa. |
| III. Extensibility Without Core Modification | PASS — `System`/`SystemArtifact` são módulos novos (`apps/api/src/modules/systems/`), não alteram contratos existentes; a ocultação do botão "Enviar para IA" é uma mudança de UI condicional, não uma remoção de capability. |
| IV. Test-Backed Quality | Mesma exceção já aceita em 001-004 (sem framework de teste automatizado configurado no monorepo) — validado via `tsc`/`eslint`/`build` limpos + validação manual ao vivo documentada em `tasks.md`, não uma violação nova desta feature. |
| V. Security & Compliance by Default | PASS — novas permissões via `RequirePermission`/`RbacGuard` (padrão já usado), soft delete (`stAtivo`) em todas as tabelas novas, `AuditLog` para as operações listadas em FR-020. |

Nenhuma violação a justificar em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-system-catalog-spec-prompt/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
├── contracts/             # Phase 1
└── tasks.md              # Phase 2 (/speckit-tasks, not this command)
```

### Source Code (repository root)

```text
apps/api/src/modules/
├── systems/                       # NEW — System/SystemArtifact catalog CRUD
│   ├── systems.controller.ts       # GET/POST/PATCH /systems, GET/POST/PATCH /systems/:id/artifacts
│   ├── systems.service.ts
│   ├── systems.module.ts
│   └── dto/system.dto.ts
├── clients/
│   └── clients.controller.ts       # EXTEND — GET/PUT /clients/:id/systems (ClientSystem N:N)
├── demands/
│   └── demands.controller.ts       # EXTEND — GET/PUT /demands/:id/systems,
│                                    #          GET/PUT /demands/:id/system-artifacts,
│                                    #          POST /demands/:id/prompt-spec
├── executions/
│   └── developer-agent.service.ts  # EXTEND — auto-catalog on discovery (FR-023)
└── audit/                          # unchanged, reused via existing AuditLog pattern

apps/web/src/
├── pages/
│   ├── Systems.tsx                 # NEW — Sistemas + Artefatos embutidos (mesmo padrão de
│   │                                #       Projects.tsx + ProjectTechnologies)
│   ├── Clients.tsx                 # EXTEND — seção "Sistemas do Cliente"
│   └── SpecificationWorkspace.tsx  # EXTEND — seleção Sistema/Artefato, "Gerar Prompt SPEC",
│                                    #          "Copiar Prompt"; "Enviar para IA" condicionado
├── services/
│   ├── useSystems.ts               # NEW
│   └── useSpecificationVersions.ts # EXTEND ou novo useSpecPrompt.ts para o endpoint de prompt
└── components/NavShell.tsx         # EXTEND — item de navegação "Sistemas"
```

**Structure Decision**: Web application monorepo já estabelecido (`apps/api` NestJS +
`apps/web` React). Novo módulo `systems` no backend segue exatamente o padrão de módulos
existentes (`roles`, `providers`, `technologies`) — controller/service/module/dto próprios,
registrado em `app.module.ts`. Nenhuma reestruturação de diretórios.

## Complexity Tracking

*Sem violações a justificar.*
