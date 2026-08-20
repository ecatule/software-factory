import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { loadProjectHomologationEnvironment } from "../executions/project-environment-config";

/**
 * spec User Story 2 (FR-012/FR-013): bloqueia qualquer execução funcional
 * contra um ambiente não autorizado ANTES de qualquer chamada real —
 * comparação determinística de string contra `homologationEnvironment` do
 * Projeto (project-environment-config.ts), nunca uma decisão da IA
 * (Constituição I). Nega por padrão: nenhum Projeto sem essa configuração
 * é tratado como "autorizado" (spec Edge Cases).
 */
@Injectable()
export class EnvironmentGuard {
  constructor(private readonly prisma: PrismaService) {}

  async validate(projectId: string, targetUrl: string): Promise<void> {
    const environment = await loadProjectHomologationEnvironment(projectId);
    const authorizedUrls = [environment?.applicationUrl, environment?.apiUrl].filter(
      (url): url is string => !!url,
    );

    if (authorizedUrls.length === 0) {
      await this.recordBlocked(projectId, targetUrl, "No homologation environment configured for this project");
      throw new Error(
        "TEST EXECUTION BLOCKED: no homologation environment configured for this project",
      );
    }

    if (!authorizedUrls.includes(targetUrl)) {
      await this.recordBlocked(
        projectId,
        targetUrl,
        "Target URL does not match the configured homologation environment",
      );
      throw new Error(
        "TEST EXECUTION BLOCKED: target URL is not the authorized homologation environment for this project",
      );
    }
  }

  /** follow-up: same reasoning as QaGenerationService.recordAudit — explicit write, no HTTP request/response cycle for AuditInterceptor to wrap. */
  private async recordBlocked(projectId: string, targetUrl: string, reason: string): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        action: "QA_FUNCTIONAL_EXECUTION_BLOCKED",
        entityType: "projects",
        entityId: projectId,
        after: { targetUrl, reason },
        correlationId: randomUUID(),
      },
    });
  }
}
