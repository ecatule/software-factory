import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

export interface SpecificationContextInput {
  business?: Record<string, unknown>;
  technical?: Record<string, unknown>;
}

/**
 * feature 003 (research.md §3): assembles the single context object sent to
 * the LLM for both a demand's first specification round (User Story 1) and
 * an increment's re-specification round (User Story 3) — one place, reused
 * by both, per constitution IV (avoid duplicated logic).
 */
@Injectable()
export class SpecificationContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * feature 004 (spec FR-003, research.md §11): resolves "branch de origem"
   * from the repository backing the demand's known artifacts when one
   * exists, falling back to the project's own branch fields otherwise
   * (edge case: multiple repositories may have diverging branches — the
   * first artifact-linked repository wins, a reasonable default absent a
   * more specific "primary repository" concept).
   */
  async resolveOriginBranch(demandId: string) {
    const demand = await this.prisma.db.demand.findUnique({
      where: { id: demandId },
      include: { project: true },
    });
    if (!demand) throw new NotFoundException(`Demand ${demandId} not found`);

    const artifactLink = await this.prisma.db.artifactRepository.findFirst({
      where: { artifact: { demandId } },
    });
    const repository = artifactLink
      ? await this.prisma.db.repository.findUnique({ where: { id: artifactLink.repositoryId } })
      : null;

    return {
      productionBranch: repository?.productionBranch ?? demand.project.productionBranch ?? null,
      homologationBranch:
        repository?.homologationBranch ?? demand.project.homologationBranch ?? null,
      source: repository ? "repository" : demand.project.productionBranch ? "project" : null,
    };
  }

  async build(demandId: string, humanInput: SpecificationContextInput) {
    const demand = await this.prisma.db.demand.findUnique({
      where: { id: demandId },
      include: { client: true, project: true, currentIncrement: true },
    });
    if (!demand) throw new NotFoundException(`Demand ${demandId} not found`);

    const [projectTechnologies, repositories, artifacts, specifications] = await Promise.all([
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
    ]);

    const approvedByDocumentType = Object.fromEntries(
      specifications
        .filter((spec) => spec.versions.length > 0)
        .map((spec) => [spec.documentType, spec.versions[0]]),
    );

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
      artifacts: artifacts.map((a) => ({ name: a.name, type: a.type, technology: a.technology, status: a.status })),
      currentIncrement: demand.currentIncrement
        ? { id: demand.currentIncrement.id, number: demand.currentIncrement.number, reason: demand.currentIncrement.reason }
        : null,
      previousApprovedSpecify: approvedByDocumentType["SPEC"]?.content ?? null,
      previousApprovedPlan: approvedByDocumentType["PLAN"]?.content ?? null,
      humanInput,
    };
  }
}
