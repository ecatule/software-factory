import type { PrismaService } from "../../common/prisma/prisma.service";
import { DashboardService } from "./dashboard.service";

/** spec FR-015 (feature 006): nenhuma demanda com teste funcional FAIL é apresentada como pronta para produção. */
describe("DashboardService.isReadyForProduction", () => {
  function build(demandStatus: string, hasFailingExecution: boolean) {
    const prisma = {
      db: {
        demand: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "demand-1", status: demandStatus }),
        },
        functionalTestExecution: {
          findFirst: jest.fn().mockResolvedValue(hasFailingExecution ? { id: "exec-1" } : null),
        },
      },
    } as unknown as PrismaService;
    return new DashboardService(prisma);
  }

  it("returns true when the demand is READY_FOR_PRODUCTION and has no FAIL execution", async () => {
    const service = build("READY_FOR_PRODUCTION", false);
    await expect(service.isReadyForProduction("demand-1")).resolves.toBe(true);
  });

  it("returns false — even with status READY_FOR_PRODUCTION — when at least one execution is FAIL (spec FR-015)", async () => {
    const service = build("READY_FOR_PRODUCTION", true);
    await expect(service.isReadyForProduction("demand-1")).resolves.toBe(false);
  });

  it("returns false when the demand hasn't reached READY_FOR_PRODUCTION yet, regardless of test results", async () => {
    const service = build("FUNCTIONAL_TESTING", false);
    await expect(service.isReadyForProduction("demand-1")).resolves.toBe(false);
  });
});
