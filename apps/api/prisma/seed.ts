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

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@software-factory.local" },
    update: {},
    create: { name: "Platform Admin", email: "admin@software-factory.local" },
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
