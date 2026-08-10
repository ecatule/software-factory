# Contract: Geração do Prompt SPEC (sem IA)

Implements spec FR-014 through FR-019, FR-024 (User Story 4).

## `POST /api/v1/demands/:id/prompt-spec` (new)

- **Body**: `{ business: string, technical: string }` — o conteúdo atual das textareas
  "Informações de negócio"/"Insumos técnicos" de `SpecificationWorkspace.tsx`, enviado tal
  como está no momento do clique (sem persistência intermediária — ver data-model.md).
- **Processamento** (síncrono, sem fila/worker — é montagem de texto, não uma execução de
  agente):
  1. Carrega a `Demand` e seu `Client`.
  2. Carrega `DemandSystem`/`DemandSystemArtifact` ativos (mesmos dados de
     `GET /demands/:id/system-artifacts`).
  3. Lê `apps/api/prompts/prompt-spec-kit.md` do disco.
  4. Substitui o placeholder `[COLE AQUI A ESPECIFICAÇÃO DE NEGÓCIO]` por um bloco
     consolidado contendo, nesta ordem: contexto da demanda (título/descrição), Cliente,
     informações de negócio, insumos técnicos, Sistemas envolvidos (nome), e para cada um
     seus Artefatos selecionados (nome/tipo/tecnologia) — mesma estrutura do exemplo em
     `documentos iniciais/3.Alteração da Software Factory...md` §12.
  5. **MUST NOT** fazer nenhuma chamada de rede a um provedor de LLM (FR-018) — string
     building puro.
- **200**: `{ prompt: string }` — o conteúdo final completo.
- Requires `SPEC_PROMPT_GENERATE`.

## Audit

Cada geração escreve um `AuditLog` (`action: "PROMPT_SPEC_GENERATED"`,
`entityType: "demands"`, `entityId: demandId`) — FR-020. O corpo do log NÃO precisa
armazenar o prompt inteiro (potencialmente grande) — só um resumo (ex. contagem de
Sistemas/Artefatos envolvidos), suficiente para rastreabilidade sem inchar `AuditLog`.

## Frontend contract

`SpecificationWorkspace.tsx`:
- Remove/condiciona o botão "Enviar para IA" e o painel de proposta da IA (research.md §5)
  — não removidos do código, só fora do JSX renderizado por padrão.
- Novo botão "Gerar Prompt SPEC" chama o endpoint acima com o `businessText`/`technicalText`
  atuais.
- O resultado é exibido numa área de texto somente-leitura (ou `MarkdownEditor` em modo
  leitura, componente já existente em `packages/ui`), com um botão "Copiar Prompt" usando
  `navigator.clipboard.writeText` (FR-017).
- Gerar novamente a qualquer momento simplesmente rechama o mesmo endpoint (FR-024) — sem
  necessidade de invalidação de cache especial, já que não há estado persistido do prompt
  em si.
