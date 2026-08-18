import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { DependencyAnalysisRunsService } from "./dependency-analysis-runs.service";

/** "Mapear todos os artefatos ativos" — bulk-triggers analysis for every active SystemArtifact of one Sistema. */
@ApiTags("dependency-analyzer")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dependency-analyzer/systems/:systemId")
export class DependencyAnalyzerBulkController {
  constructor(private readonly runs: DependencyAnalysisRunsService) {}

  @Post("analyze-all")
  @RequirePermission("DEPENDENCY_ANALYZER_WRITE")
  analyzeAll(@Param("systemId") systemId: string) {
    return this.runs.createForSystem(systemId);
  }

  /** "Atualizar status" — manual-refresh aggregate progress for the bulk trigger above. */
  @Get("analyze-all/status")
  @RequirePermission("DEPENDENCY_ANALYZER_READ")
  getStatus(@Param("systemId") systemId: string) {
    return this.runs.getSystemStatus(systemId);
  }
}
