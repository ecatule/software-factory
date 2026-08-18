import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { DependencyAnalyzerService } from "./dependency-analyzer.service";
import { DependencyAnalysisRunsService } from "./dependency-analysis-runs.service";

/**
 * Mapa de Dependências — Frontend → API, Backend route → Controller →
 * Service, and API → API. Scoped by `SystemArtifact` (the reusable catalog
 * of a system's real artifacts — "artefatos ativos do sistema"), not the
 * demand-scoped `Artifact` — triggered from the "Artefatos" table on a
 * Sistema's detail screen.
 */
@ApiTags("dependency-analyzer")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dependency-analyzer/system-artifacts/:systemArtifactId")
export class DependencyAnalyzerController {
  constructor(
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
    private readonly runs: DependencyAnalysisRunsService,
  ) {}

  /** Triggered from the Artefatos do Sistema table — enqueues a run, returns immediately (see DependencyAnalysisRunsService/Processor). */
  @Post("analyze")
  @RequirePermission("DEPENDENCY_ANALYZER_WRITE")
  analyze(@Param("systemArtifactId") systemArtifactId: string) {
    return this.runs.create(systemArtifactId);
  }

  @Get("runs/latest")
  @RequirePermission("DEPENDENCY_ANALYZER_READ")
  getLatestRun(@Param("systemArtifactId") systemArtifactId: string) {
    return this.runs.getLatestForArtifact(systemArtifactId);
  }

  @Get("dependencies")
  @RequirePermission("DEPENDENCY_ANALYZER_READ")
  getDependencies(@Param("systemArtifactId") systemArtifactId: string) {
    return this.dependencyAnalyzer.getDependencies(systemArtifactId);
  }

  /** "Artefatos relacionados" — feeds the specification wizard's dependency preview. */
  @Get("related")
  @RequirePermission("DEPENDENCY_ANALYZER_READ")
  getRelated(@Param("systemArtifactId") systemArtifactId: string) {
    return this.dependencyAnalyzer.getRelatedSystemArtifacts(systemArtifactId);
  }
}
