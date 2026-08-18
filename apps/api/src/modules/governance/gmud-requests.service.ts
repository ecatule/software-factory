import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CHANGE_MANAGEMENT_PROVIDER,
  type ChangeManagementProvider,
} from "@software-factory/domain";
import { GmudEnvironment } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DemandsService } from "../demands/demands.service";

/** exact label text the Monday board's "Ambiente" dropdown expects — confirmed live against the real board. */
const ENVIRONMENT_LABELS: Record<GmudEnvironment, string> = {
  HOMOLOGACAO: "homologação",
  PRODUCAO: "produção",
};

/**
 * GMUD (Gestão de Mudanças): opens a deploy request on the platform's fixed
 * Monday change-management board for a Demand, via `ChangeManagementProvider`
 * (no vendor-specific code here — constitution: Provider Abstraction).
 */
@Injectable()
export class GmudRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demandsService: DemandsService,
    @Inject(CHANGE_MANAGEMENT_PROVIDER)
    private readonly changeManagementProvider: ChangeManagementProvider,
  ) {}

  async create(demandId: string, environment: GmudEnvironment) {
    const demand = await this.demandsService.get(demandId);

    const client = await this.prisma.db.client.findUnique({ where: { id: demand.clientId } });
    if (!client) throw new NotFoundException(`Client ${demand.clientId} not found`);

    const artifacts = await this.listAllArtifactsEverSelected(demandId);

    const result = await this.changeManagementProvider.createChangeRequest({
      itemName: `${demand.externalId} — ${demand.title}`,
      clientLabel: client.mondayClientLabel ?? client.name,
      environmentLabel: ENVIRONMENT_LABELS[environment],
      artifactsText: this.formatArtifactsText(artifacts),
      requestDate: new Date().toISOString().slice(0, 10),
    });

    return this.prisma.db.gmudRequest.create({
      data: {
        demandId,
        environment,
        mondayItemId: result.externalId,
        mondayItemUrl: result.url,
      },
    });
  }

  /**
   * follow-up: `DemandsService.getAvailableAndSelectedSystemArtifacts`'s
   * `selected` list is scoped to the CURRENT active selection only
   * (`setSelectedSystemArtifacts` deactivates whatever isn't resubmitted on
   * each "Salvar seleção") — right for the wizard's own picker, wrong for
   * a GMUD deploy request, which needs every artifact the demand ever
   * touched across every rodada/incremento, not just the latest one. The
   * `(demandId, systemArtifactId)` composite key already guarantees no
   * duplicate rows per artifact, so dropping the `stAtivo` filter is enough
   * — no separate dedupe needed. Still excludes artifacts later removed
   * from the catalog itself (`SystemArtifact.stAtivo: false`).
   */
  /** exposed too (via GmudRequestsController) so the trigger screen's preview shows exactly what `create()` will send. */
  async listAllArtifactsEverSelected(demandId: string) {
    const links = await this.prisma.db.demandSystemArtifact.findMany({
      where: { demandId, systemArtifact: { stAtivo: true } },
      include: { systemArtifact: true },
    });
    return links.map((link) => link.systemArtifact);
  }

  async listForDemand(demandId: string) {
    return this.prisma.db.gmudRequest.findMany({
      where: { demandId, stAtivo: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** "usuários conhecem a Tela pela descrição do menu, não pelo nome técnico" — same convention as PromptSpecService. */
  private formatArtifactsText(artifacts: { name: string; description: string | null }[]): string {
    if (artifacts.length === 0) return "(nenhum artefato selecionado)";
    return artifacts
      .map((a) => (a.description && a.description !== a.name ? `${a.name} — ${a.description}` : a.name))
      .join("\n");
  }
}
