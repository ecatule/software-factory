import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * spec 002 User Story 9: the Agent catalog itself was never exposed by 001
 * (only AgentExecution has endpoints) — this small module closes that gap.
 */
@ApiTags("agents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("agents")
export class AgentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.db.agent.findMany({ orderBy: { name: "asc" } });
  }
}
