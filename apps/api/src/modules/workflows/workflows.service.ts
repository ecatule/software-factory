import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * spec FR-004/FR-005: drives Demand.status through the project's Workflow
 * (falling back to the platform-default workflow, projectId = null) using
 * the data-driven WorkflowStage/WorkflowTransition tables, so new stages can
 * be added without touching in-flight demands or this service's code.
 */
@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveWorkflow(projectId: string) {
    const workflow =
      (await this.prisma.db.workflow.findFirst({ where: { projectId } })) ??
      (await this.prisma.db.workflow.findFirst({ where: { projectId: null } }));
    if (!workflow) {
      throw new NotFoundException("No workflow configured (not even the platform default)");
    }
    return workflow;
  }

  async getWorkflowView(demandId: string) {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const workflow = await this.resolveWorkflow(demand.projectId);
    const stages = await this.prisma.db.workflowStage.findMany({
      where: { workflowId: workflow.id },
      orderBy: { order: "asc" },
    });
    return { stages, currentStage: demand.status };
  }

  /** Advances demand.status to the given target stage if a transition allows it. */
  async transition(demandId: string, toStageKey: string, actingUserId?: string) {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const workflow = await this.resolveWorkflow(demand.projectId);

    const fromStage = await this.prisma.db.workflowStage.findUniqueOrThrow({
      where: { workflowId_key: { workflowId: workflow.id, key: demand.status } },
    });
    const toStage = await this.prisma.db.workflowStage.findUnique({
      where: { workflowId_key: { workflowId: workflow.id, key: toStageKey } },
    });
    if (!toStage) {
      throw new BadRequestException(`Unknown stage "${toStageKey}" for this workflow`);
    }

    const allowed = await this.prisma.db.workflowTransition.findFirst({
      where: { workflowId: workflow.id, fromStageId: fromStage.id, toStageId: toStage.id },
    });
    if (!allowed) {
      throw new BadRequestException(
        `Transition ${demand.status} → ${toStageKey} is not allowed by this workflow`,
      );
    }

    const updated = await this.prisma.db.demand.update({
      where: { id: demandId },
      data: { status: toStageKey, updatedBy: actingUserId },
    });
    await this.recordStageTransition(demandId, demand.status, toStageKey, actingUserId);
    return updated;
  }

  /** Advances by exactly one step, used by the execution worker after a stage completes. */
  async advanceToNextStage(demandId: string, actingUserId?: string) {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const workflow = await this.resolveWorkflow(demand.projectId);
    const currentStage = await this.prisma.db.workflowStage.findUniqueOrThrow({
      where: { workflowId_key: { workflowId: workflow.id, key: demand.status } },
    });
    const nextTransition = await this.prisma.db.workflowTransition.findFirst({
      where: { workflowId: workflow.id, fromStageId: currentStage.id },
    });
    if (!nextTransition) {
      return demand;
    }
    const nextStage = await this.prisma.db.workflowStage.findUniqueOrThrow({
      where: { id: nextTransition.toStageId },
    });
    const updated = await this.prisma.db.demand.update({
      where: { id: demandId },
      data: { status: nextStage.key, updatedBy: actingUserId },
    });
    await this.recordStageTransition(demandId, demand.status, nextStage.key, actingUserId);
    return updated;
  }

  /**
   * feature 004 (spec FR-011, research.md §6): explicit AuditLog write so
   * stage transitions are captured even when triggered from a BullMQ worker
   * (ExecutionsProcessor calling advanceToNextStage), which the global
   * AuditInterceptor never sees — it only wraps HTTP request/response
   * cycles. DashboardService pairs consecutive rows per demand to compute
   * average time per stage.
   */
  private async recordStageTransition(
    demandId: string,
    fromStatus: string,
    toStatus: string,
    actorUserId?: string,
  ) {
    await this.prisma.db.auditLog.create({
      data: {
        actorUserId,
        action: "STAGE_TRANSITION",
        entityType: "demands",
        entityId: demandId,
        before: { status: fromStatus },
        after: { status: toStatus },
        correlationId: randomUUID(),
      },
    });
  }
}
