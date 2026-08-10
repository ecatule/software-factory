# Quickstart: Gestão de Sistemas, Artefatos e Especificação Assistida sem IA direta

Prerequisites: `apps/api` rodando contra a instância Postgres real.

## Step 1 — Cadastrar Sistemas e Artefatos (User Story 1)

1. Na nova tela **Sistemas**, cadastre um Sistema (ex. "Vexur"), confirme que aparece
   ativo na listagem.
2. Dentro dele, cadastre um Artefato (nome, tipo, tecnologia); confirme que aparece
   vinculado.
3. Inative o Sistema; confirme que ele some da listagem padrão e que não é mais possível
   cadastrar um novo Artefato ativo nele (FR-003).

## Step 2 — Associar Sistemas a Clientes (User Story 2)

1. Edite um Cliente, na seção "Sistemas" associe o Sistema criado no Step 1.
2. Confirme que o mesmo Sistema pode ser associado a um segundo Cliente sem conflito
   (N:N — o caso real do Vexur que motivou a decisão de entidades independentes).
3. Tente associar o mesmo Sistema duas vezes ao mesmo Cliente; confirme rejeição (FR-005).
4. Remova a associação; confirme que nem o Cliente nem o Sistema são excluídos.

## Step 3 — Selecionar Sistemas/Artefatos na Especificação Assistida (User Story 3)

1. Abra a Especificação Assistida de uma demanda do Cliente do Step 2; confirme que só o
   Sistema associado aparece disponível (FR-007) — sistemas de outros clientes ficam
   ocultos.
2. Selecione o Sistema; confirme que só os Artefatos ativos dele aparecem (FR-009).
3. Selecione um ou mais Artefatos; recarregue a tela; confirme que a seleção persiste
   (FR-011).
4. Via chamada direta à API (contornando o frontend), tente selecionar um Artefato de um
   Sistema não selecionado para a demanda; confirme rejeição 422 (FR-012, SC-006).
5. Da mesma forma, tente selecionar um Sistema não associado ao Cliente da demanda;
   confirme rejeição 422 (FR-013).
6. Na tela Sistemas, inative o Sistema (ou Artefato) selecionado no passo 3; reabra a
   Especificação Assistida dessa mesma demanda e confirme que a seleção anterior continua
   visível no histórico, mesmo o Sistema/Artefato não estando mais disponível para novas
   seleções (FR-025, `/speckit.analyze` finding F2).

## Step 4 — Gerar e copiar o Prompt SPEC, sem IA (User Story 4)

1. Preencha "Informações de negócio" e "Insumos técnicos" na mesma tela.
2. Confirme que o botão "Enviar para IA" não está mais disponível (FR-019).
3. Clique "Gerar Prompt SPEC"; confirme que o conteúdo exibido inclui negócio, técnico,
   Cliente, Sistemas e Artefatos selecionados, estruturado a partir do template
   `prompt-spec-kit.md`.
4. Clique "Copiar Prompt"; confirme que a área de transferência recebe o conteúdo completo.
5. Altere a seleção de Artefatos e gere de novo; confirme que o novo prompt reflete a
   mudança (FR-024).
6. Confirme, inspecionando logs/rede durante os passos 3 e 5, que nenhuma chamada saiu
   para `api.openai.com`/`api.anthropic.com`/qualquer provedor de LLM (FR-018, SC-005).

## Step 5 — Descoberta automática pelo Developer Agent (Edge Case)

1. Dispare uma execução do agente "developer" numa demanda com Sistema já selecionado.
2. Se o agente descobrir um arquivo fora do escopo planejado, confirme que um novo
   `SystemArtifact` aparece no catálogo do Sistema da demanda **e** já selecionado para
   essa demanda (FR-023), sem passo manual.

## Expected outcome

As 4 user stories validadas ponta a ponta contra o Postgres real. Nenhuma chamada de LLM
ocorre em nenhum momento deste fluxo — diferente de `specs/003-ai-assisted-specification/`
e do "Modo B" (`specs/004-advanced-console-governance/`), que continuam existindo e
funcionando, só não são mais alcançáveis a partir desta tela.
