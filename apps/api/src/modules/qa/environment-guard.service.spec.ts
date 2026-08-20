import type { PrismaService } from "../../common/prisma/prisma.service";
import { loadProjectHomologationEnvironment } from "../executions/project-environment-config";
import { EnvironmentGuard } from "./environment-guard.service";

jest.mock("../executions/project-environment-config");

const loadProjectHomologationEnvironmentMock = loadProjectHomologationEnvironment as jest.MockedFunction<
  typeof loadProjectHomologationEnvironment
>;

/** spec User Story 2 (FR-012/FR-013): comparação determinística, nunca "autorizado por padrão". */
describe("EnvironmentGuard", () => {
  function build() {
    const auditLogCreate = jest.fn().mockResolvedValue(undefined);
    const prisma = { db: { auditLog: { create: auditLogCreate } } } as unknown as PrismaService;
    return { guard: new EnvironmentGuard(prisma), auditLogCreate };
  }

  beforeEach(() => {
    loadProjectHomologationEnvironmentMock.mockReset();
  });

  it("allows an authorized homologation applicationUrl", async () => {
    loadProjectHomologationEnvironmentMock.mockResolvedValue({
      applicationUrl: "https://stage-corpesaude.vexur.com.br",
      apiUrl: "https://stage-api-corpesaude.vexur.com.br",
    });
    const { guard, auditLogCreate } = build();

    await expect(
      guard.validate("project-1", "https://stage-corpesaude.vexur.com.br"),
    ).resolves.toBeUndefined();
    expect(auditLogCreate).not.toHaveBeenCalled();
  });

  it("allows an authorized homologation apiUrl", async () => {
    loadProjectHomologationEnvironmentMock.mockResolvedValue({
      applicationUrl: "https://stage-corpesaude.vexur.com.br",
      apiUrl: "https://stage-api-corpesaude.vexur.com.br",
    });
    const { guard } = build();

    await expect(
      guard.validate("project-1", "https://stage-api-corpesaude.vexur.com.br"),
    ).resolves.toBeUndefined();
  });

  it("blocks a production-looking URL that doesn't match the configured homologation environment", async () => {
    loadProjectHomologationEnvironmentMock.mockResolvedValue({
      applicationUrl: "https://stage-corpesaude.vexur.com.br",
    });
    const { guard, auditLogCreate } = build();

    await expect(guard.validate("project-1", "https://corpesaude.vexur.com.br")).rejects.toThrow(
      "TEST EXECUTION BLOCKED",
    );
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "QA_FUNCTIONAL_EXECUTION_BLOCKED" }),
    });
  });

  it("blocks (never authorizes by default) when the project has no homologation environment configured at all", async () => {
    loadProjectHomologationEnvironmentMock.mockResolvedValue(undefined);
    const { guard, auditLogCreate } = build();

    await expect(guard.validate("unconfigured-project", "https://anything.example.com")).rejects.toThrow(
      "TEST EXECUTION BLOCKED",
    );
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "QA_FUNCTIONAL_EXECUTION_BLOCKED" }),
    });
  });

  it("blocks when the configuration exists but has neither applicationUrl nor apiUrl set", async () => {
    loadProjectHomologationEnvironmentMock.mockResolvedValue({});
    const { guard } = build();

    await expect(guard.validate("project-1", "https://anything.example.com")).rejects.toThrow(
      "TEST EXECUTION BLOCKED",
    );
  });
});
