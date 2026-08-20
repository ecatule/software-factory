import { PrismaClient, ProviderKind } from "@prisma/client";

const prisma = new PrismaClient();

const WORKFLOW_STAGES = [
  "NEW",
  "SPECIFICATION",
  "CLARIFICATION",
  "PLANNING",
  "CHECKLIST",
  "TASKS",
  "ANALYSIS",
  "READY_FOR_DEVELOPMENT",
  "DEVELOPMENT",
  "TESTING",
  "COMMIT",
  "PULL_REQUEST",
  // feature 006 (data-model.md "Demand.status"): extensão do fluxo de QA/teste
  // funcional — nenhuma automação de transição para estes estados nesta
  // rodada (spec Assumptions), servem para exibição/rastreio; avanço
  // continua manual onde já é manual hoje (PR, GMUD).
  "IMPLEMENTED",
  "TESTS_GENERATED",
  "PR_CREATED",
  "PR_APPROVED",
  "GMUD_CREATED",
  "DEPLOYED_HOMOLOGATION",
  "READY_FOR_FUNCTIONAL_TEST",
  "FUNCTIONAL_TESTING",
  "FUNCTIONAL_TEST_PASSED",
  "FUNCTIONAL_TEST_FAILED",
  "READY_FOR_PRODUCTION",
  "BLOCKED",
  "FAILED",
  "CANCELLED",
] as const;

/** feature 006: excluded from the straight-line chain below — exception/failure branches, not a "next step" in the happy path. */
const WORKFLOW_EXCEPTION_STAGES = ["BLOCKED", "FAILED", "CANCELLED", "FUNCTIONAL_TEST_FAILED"];

// feature 004 (spec FR-004): granular permissions, all granted to the
// `admin` role by default (FR-008) so no admin loses access already held.
const PERMISSION_CATALOG = [
  "DEMAND_READ",
  "DEMAND_WRITE",
  "SPECIFICATION_WRITE",
  "SPECIFICATION_APPROVE",
  "AGENT_EXECUTE",
  "GIT_WRITE",
  "PR_CREATE",
  "AUDIT_READ",
  // ErrorLog: failed-request diagnostics (stack traces included) — kept
  // separate from AUDIT_READ since it's a more sensitive resource, not
  // every AUDIT_READ holder should also see raw exception internals.
  "ERROR_LOG_READ",
  // feature 005 (research.md §3): System/SystemArtifact catalog + demand
  // selection + Prompt SPEC generation.
  "SYSTEM_READ",
  "SYSTEM_WRITE",
  "SYSTEM_ARTIFACT_READ",
  "SYSTEM_ARTIFACT_WRITE",
  "DEMAND_SYSTEM_WRITE",
  "SPEC_PROMPT_GENERATE",
  // Mapa de Dependências: trigger analysis / read the resulting graph.
  "DEPENDENCY_ANALYZER_WRITE",
  "DEPENDENCY_ANALYZER_READ",
  // GMUD (Gestão de Mudanças): open a deploy request on Monday / read past requests.
  "GMUD_WRITE",
  "GMUD_READ",
  // feature 006 (spec Clarification #2): QA_EXECUTE mantida separada de
  // AGENT_EXECUTE — dispara execução real contra um ambiente de homologação,
  // não apenas geração de código.
  "QA_READ",
  "QA_EXECUTE",
  // feature 006 (pipeline configurável): controla quem pode mudar se uma
  // etapa do pipeline "developer" roda automaticamente ou exige um clique
  // manual — afeta TODA execução da plataforma, não só uma demanda.
  "PIPELINE_CONFIG_WRITE",
] as const;

const PROVIDER_CATALOG: { key: string; kind: ProviderKind }[] = [
  { key: "monday", kind: ProviderKind.DEMAND_SOURCE },
  { key: "github", kind: ProviderKind.CODE_REPOSITORY },
  { key: "chatgpt", kind: ProviderKind.LLM },
  { key: "claude", kind: ProviderKind.LLM },
  { key: "speckit", kind: ProviderKind.SDD },
  { key: "minio", kind: ProviderKind.STORAGE },
];

async function seedIdentity() {
  const adminPermission = await prisma.permission.upsert({
    where: { name: "platform:admin" },
    update: {},
    create: { name: "platform:admin", description: "Full platform access" },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: { name: "admin", description: "Platform administrator" },
  });

  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: adminRole.id, permissionId: adminPermission.id } },
    update: {},
    create: { roleId: adminRole.id, permissionId: adminPermission.id },
  });

  for (const name of PERMISSION_CATALOG) {
    const permission = await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: { stAtivo: true },
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@software-factory.local";
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "Platform Admin", email: adminEmail },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
}

/** feature 006: was create-only-if-missing (never touched an existing workflow again) — rewritten as an upsert per stage/transition so re-running seed can add newly appended WORKFLOW_STAGES entries to an already-seeded "default" workflow without duplicating what's already there. */
async function seedDefaultWorkflow() {
  const workflow =
    (await prisma.workflow.findFirst({ where: { name: "default", projectId: null } })) ??
    (await prisma.workflow.create({ data: { name: "default", projectId: null } }));

  const stages = [];
  for (let index = 0; index < WORKFLOW_STAGES.length; index += 1) {
    const key = WORKFLOW_STAGES[index];
    stages.push(
      await prisma.workflowStage.upsert({
        where: { workflowId_key: { workflowId: workflow.id, key } },
        update: { order: index },
        create: { workflowId: workflow.id, key, order: index },
      }),
    );
  }

  const linear = stages.filter((s) => !WORKFLOW_EXCEPTION_STAGES.includes(s.key));
  for (let i = 0; i < linear.length - 1; i += 1) {
    await ensureWorkflowTransition(workflow.id, linear[i].id, linear[i + 1].id);
  }

  // feature 006: FUNCTIONAL_TESTING can also end in failure, not only PASSED.
  const functionalTesting = stages.find((s) => s.key === "FUNCTIONAL_TESTING");
  const functionalTestFailed = stages.find((s) => s.key === "FUNCTIONAL_TEST_FAILED");
  if (functionalTesting && functionalTestFailed) {
    await ensureWorkflowTransition(workflow.id, functionalTesting.id, functionalTestFailed.id);
  }
}

async function ensureWorkflowTransition(workflowId: string, fromStageId: string, toStageId: string) {
  const existing = await prisma.workflowTransition.findFirst({
    where: { workflowId, fromStageId, toStageId },
  });
  if (existing) return;
  await prisma.workflowTransition.create({ data: { workflowId, fromStageId, toStageId } });
}

async function seedProviders() {
  for (const provider of PROVIDER_CATALOG) {
    await prisma.provider.upsert({
      where: { key: provider.key },
      update: {},
      create: provider,
    });
  }
}

const AGENT_CATALOG = [
  { name: "SpecificationAgent", type: "specification" },
  // spec User Story 6: registered here so ExecutionsProcessor's
  // `agent.type === "developer"` branch has a real Agent row to reference.
  { name: "DeveloperAgent", type: "developer" },
  // feature 003: ExecutionsProcessor's `agent.type === "specification_copilot"`
  // branch (the AI-assisted specification round).
  { name: "SpecificationCopilotAgent", type: "specification_copilot" },
  // feature 006 (spec FR-018/research.md §3): novo estágio dentro da MESMA
  // AgentExecution do tipo "developer" (ExecutionsProcessor), entre
  // `implement` e `commit` — não um worker/fila separado.
  { name: "QA Agent", type: "qa" },
];

async function seedAgents() {
  for (const agent of AGENT_CATALOG) {
    const existing = await prisma.agent.findFirst({ where: { name: agent.name } });
    if (!existing) {
      await prisma.agent.create({ data: agent });
    }
  }
}

// feature 006 (pipeline configurável): as 9 etapas do branch "developer" em
// ExecutionsProcessor, na mesma ordem em que rodam — todas "AUTO" por
// padrão, preservando o comportamento já existente.
const PIPELINE_STAGES_CATALOG = [
  "branches",
  "cloning",
  "safety-check",
  "tasks",
  "analyze",
  "checklist",
  "implement",
  "qa-generation",
  "commit",
];

async function seedPipelineStageConfig() {
  for (const stage of PIPELINE_STAGES_CATALOG) {
    await prisma.pipelineStageConfig.upsert({
      where: { stage },
      update: {},
      create: { stage, mode: "AUTO" },
    });
  }
}

async function main() {
  await seedIdentity();
  await seedDefaultWorkflow();
  await seedProviders();
  await seedAgents();
  await seedPipelineStageConfig();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
