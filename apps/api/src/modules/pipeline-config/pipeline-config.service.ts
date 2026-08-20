import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DEVELOPER_STAGE_ORDER } from "./pipeline-stage-order";

/**
 * feature 006 (pipeline configurável): configuração GLOBAL da plataforma
 * sobre quais etapas do pipeline "developer" (ExecutionsProcessor) rodam
 * automaticamente e quais exigem um clique manual ("Avançar etapa").
 * `getMode` nega-por-exceção-segura: uma etapa sem linha configurada (nunca
 * deveria acontecer, já que o seed cria as 9) é tratada como "AUTO" — o
 * mesmo comportamento de sempre, nunca bloqueia por acidente uma etapa que
 * ninguém decidiu tornar manual.
 */
@Injectable()
export class PipelineConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** ordenado pela ordem REAL de execução (DEVELOPER_STAGE_ORDER), não alfabética — "analyze" não vem antes de "branches" na tela. */
  async list() {
    const rows = await this.prisma.db.pipelineStageConfig.findMany();
    const orderIndex = new Map<string, number>(DEVELOPER_STAGE_ORDER.map((stage, index) => [stage, index]));
    return rows.sort((a, b) => (orderIndex.get(a.stage) ?? 99) - (orderIndex.get(b.stage) ?? 99));
  }

  async getMode(stage: string): Promise<"AUTO" | "MANUAL"> {
    const config = await this.prisma.db.pipelineStageConfig.findUnique({ where: { stage } });
    return config?.mode === "MANUAL" ? "MANUAL" : "AUTO";
  }

  async updateMode(stage: string, mode: "AUTO" | "MANUAL") {
    const existing = await this.prisma.db.pipelineStageConfig.findUnique({ where: { stage } });
    if (!existing) throw new NotFoundException(`Unknown pipeline stage "${stage}"`);
    return this.prisma.db.pipelineStageConfig.update({ where: { stage }, data: { mode } });
  }
}
