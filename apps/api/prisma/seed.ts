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
  "BLOCKED",
  "FAILED",
  "CANCELLED",
] as const;

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
  // feature 005 (research.md §3): System/SystemArtifact catalog + demand
  // selection + Prompt SPEC generation.
  "SYSTEM_READ",
  "SYSTEM_WRITE",
  "SYSTEM_ARTIFACT_READ",
  "SYSTEM_ARTIFACT_WRITE",
  "DEMAND_SYSTEM_WRITE",
  "SPEC_PROMPT_GENERATE",
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

async function seedDefaultWorkflow() {
  const existing = await prisma.workflow.findFirst({
    where: { name: "default", projectId: null },
  });
  if (existing) return;

  const workflow = await prisma.workflow.create({
    data: { name: "default", projectId: null },
  });

  const stages = await Promise.all(
    WORKFLOW_STAGES.map((key, index) =>
      prisma.workflowStage.create({
        data: { workflowId: workflow.id, key, order: index },
      }),
    ),
  );

  const linear = stages.filter(
    (s) => !["BLOCKED", "FAILED", "CANCELLED"].includes(s.key),
  );
  for (let i = 0; i < linear.length - 1; i += 1) {
    await prisma.workflowTransition.create({
      data: {
        workflowId: workflow.id,
        fromStageId: linear[i].id,
        toStageId: linear[i + 1].id,
      },
    });
  }
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
];

async function seedAgents() {
  for (const agent of AGENT_CATALOG) {
    const existing = await prisma.agent.findFirst({ where: { name: agent.name } });
    if (!existing) {
      await prisma.agent.create({ data: agent });
    }
  }
}

async function main() {
  await seedIdentity();
  await seedDefaultWorkflow();
  await seedProviders();
  await seedAgents();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
