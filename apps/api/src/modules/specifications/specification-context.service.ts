import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DependencyAnalyzerService } from "../dependency-analyzer/dependency-analyzer.service";

export interface SpecificationContextInput {
  business?: Record<string, unknown>;
  technical?: Record<string, unknown>;
}

export interface TechnicalDependencySummary {
  artifactName: string;
  callsApis: string[];
  exposesApis: string[];
}

/**
 * feature 003 (research.md §3): assembles the single context object sent to
 * the LLM for both a demand's first specification round (User Story 1) and
 * an increment's re-specification round (User Story 3) — one place, reused
 * by both, per constitution IV (avoid duplicated logic).
 */
@Injectable()
export class SpecificationContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
  ) {}

  /**
   * feature 004 (spec FR-003, research.md §11): resolves "branch de origem"
   * directly from the demand's Project — same lookup `build()`'s own
   * `repositories` field already uses below, just narrowed to one row.
   * follow-up: previously went through `Artifact`→`ArtifactRepository`,
   * which only exists after an analyst has already selected and saved
   * "Sistemas e Artefatos" — always empty for a brand-new demand, even
   * when the Project's repository was registered long ago. Live-observed:
   * every Project today has exactly one active Repository (one git base
   * shared by every artifact under it, not one per artifact), so
   * resolving by `projectId` is not a lossy simplification here — "first
   * active repository wins" only matters as a tiebreaker if that ever
   * changes. With no repository resolvable yet, this returns nulls and
   * the frontend prompts the analyst to fill it in manually.
   */
  async resolveOriginBranch(demandId: string) {
    const demand = await this.prisma.db.demand.findUnique({ where: { id: demandId } });
    if (!demand) throw new NotFoundException(`Demand ${demandId} not found`);

    const repository = await this.prisma.db.repository.findFirst({
      where: { projectId: demand.projectId, stAtivo: true },
    });

    return {
      productionBranch: repository?.productionBranch ?? null,
      homologationBranch: repository?.homologationBranch ?? null,
      source: repository ? "repository" : null,
    };
  }

  async build(demandId: string, humanInput: SpecificationContextInput) {
    const demand = await this.prisma.db.demand.findUnique({
      where: { id: demandId },
      include: { client: true, project: true, currentIncrement: true },
    });
    if (!demand) throw new NotFoundException(`Demand ${demandId} not found`);

    const [projectTechnologies, repositories, artifacts, specifications, selectedSystemArtifacts] =
      await Promise.all([
        this.prisma.db.projectTechnology.findMany({
          where: { projectId: demand.projectId, stAtivo: true },
          include: { technology: true },
        }),
        this.prisma.db.repository.findMany({ where: { projectId: demand.projectId } }),
        this.prisma.db.artifact.findMany({ where: { demandId } }),
        this.prisma.db.specification.findMany({
          where: { demandId },
          include: {
            versions: { where: { status: "APPROVED" }, orderBy: { versionNumber: "desc" }, take: 1 },
          },
        }),
        this.prisma.db.demandSystemArtifact.findMany({
          where: { demandId, stAtivo: true },
          include: { systemArtifact: true },
        }),
      ]);

    const approvedByDocumentType = Object.fromEntries(
      specifications
        .filter((spec) => spec.versions.length > 0)
        .map((spec) => [spec.documentType, spec.versions[0]]),
    );

    const technicalDependencies = await this.buildTechnicalDependencies(selectedSystemArtifacts);

    return {
      demand: { id: demand.id, title: demand.title, description: demand.description, type: demand.type, priority: demand.priority },
      client: { id: demand.client.id, name: demand.client.name },
      project: { id: demand.project.id, name: demand.project.name },
      technologies: projectTechnologies.map((pt) => ({
        name: pt.technology.name,
        category: pt.technology.category,
        version: pt.technology.techVersion,
      })),
      repositories: repositories.map((r) => ({ id: r.id, externalReference: r.externalReference })),
      // `description` is often how business users actually know a Tela
      // (its menu label, e.g. "Relacionamento com cliente") rather than its
      // technical component name — already copied onto `Artifact` at
      // creation time (see `DemandsService.ensureArtifactsForSystemArtifacts`),
      // just wasn't reaching the AI context until now.
      artifacts: artifacts.map((a) => ({
        name: a.name,
        type: a.type,
        technology: a.technology,
        status: a.status,
        description: a.description,
      })),
      // "artefatos ativos do sistema" (Mapa de Dependências) selected for
      // this demand, summarized — real API calls/exposed routes the AI can
      // ground the SPEC/PLAN in, so a non-technical analyst's selection
      // still produces a technically-aware document even if they never open
      // the dependency preview themselves (see `SystemSelection` on the
      // frontend for the interactive counterpart).
      technicalDependencies,
      currentIncrement: demand.currentIncrement
        ? { id: demand.currentIncrement.id, number: demand.currentIncrement.number, reason: demand.currentIncrement.reason }
        : null,
      previousApprovedSpecify: approvedByDocumentType["SPEC"]?.content ?? null,
      previousApprovedPlan: approvedByDocumentType["PLAN"]?.content ?? null,
      humanInput,
    };
  }

  /**
   * Summarized (method+url only, deduped — no file/line/confidence, that's
   * evidence detail for a human clicking around, not useful LLM prompt
   * weight) per selected SystemArtifact. A per-artifact failure (never
   * analyzed yet, or a stale/removed repository link) never breaks SPEC
   * generation for the others — it just contributes an empty entry.
   */
  private async buildTechnicalDependencies(
    selectedSystemArtifacts: Array<{ systemArtifactId: string; systemArtifact: { name: string } }>,
  ): Promise<TechnicalDependencySummary[]> {
    return Promise.all(
      selectedSystemArtifacts.map(async (link) => {
        try {
          const mapping = await this.dependencyAnalyzer.getDependencies(link.systemArtifactId);
          const callsApis = new Set<string>();
          for (const call of mapping.screens) callsApis.add(`${call.method} ${call.url}`);
          for (const call of mapping.outboundCalls) callsApis.add(`${call.method} ${call.url}`);
          const exposesApis = new Set(mapping.exposedRoutes.map((route) => `${route.method} ${route.url}`));
          return {
            artifactName: link.systemArtifact.name,
            callsApis: [...callsApis],
            exposesApis: [...exposesApis],
          };
        } catch {
          return { artifactName: link.systemArtifact.name, callsApis: [], exposesApis: [] };
        }
      }),
    );
  }
}
