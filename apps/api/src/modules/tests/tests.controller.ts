import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TestRunnerService } from "./test-runner.service";

@ApiTags("tests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("demands/:demandId/tests")
export class TestsController {
  constructor(
    private readonly testRunner: TestRunnerService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@Param("demandId") demandId: string) {
    return this.prisma.db.testExecution.findMany({
      where: { demandId },
      include: { result: true },
      orderBy: { startedAt: "desc" },
    });
  }

  @Post("run")
  run(@Param("demandId") demandId: string) {
    return this.testRunner.runRequiredSuites(demandId);
  }
}
