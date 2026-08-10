import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

export interface SddExecutionContext {
  model?: string;
  authProfileKey?: string;
}

/**
 * Resolves the ProviderConfiguration row that actually applies to a given
 * project + SDD pipeline stage — the Settings screen (feature 002 US15) has
 * always let an admin save these rows, but until now nothing at execution
 * time ever read them back. Picks the most specific match:
 * (project, stage) > (project, any stage) > (platform, stage) > (platform, any stage).
 */
@Injectable()
export class ProviderConfigurationResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveSddContext(
    projectId: string | null,
    stage: string,
  ): Promise<SddExecutionContext> {
    const provider = await this.prisma.db.provider.findUnique({ where: { key: "speckit" } });
    if (!provider) return {};

    const candidates = await this.prisma.db.providerConfiguration.findMany({
      where: { providerId: provider.id, stAtivo: true },
    });

    const match =
      candidates.find((c) => c.projectId === projectId && c.pipelineStage === stage) ??
      candidates.find((c) => c.projectId === projectId && c.pipelineStage === null) ??
      candidates.find((c) => c.projectId === null && c.pipelineStage === stage) ??
      candidates.find((c) => c.projectId === null && c.pipelineStage === null);

    if (!match) return {};
    const settings = match.settings as Record<string, unknown>;
    return {
      model: typeof settings.model === "string" ? settings.model : undefined,
      authProfileKey:
        typeof settings.authProfileKey === "string" ? settings.authProfileKey : undefined,
    };
  }
}
