import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";

@ApiTags("audits")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("audits")
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /** spec 001 FR-025 / spec 002 FR-028 (now paginated, contracts/console-lists.md). */
  @Get()
  list(
    @Query("entity_type") entityType?: string,
    @Query("entity_id") entityId?: string,
    @Query("actor_user_id") actorUserId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      entityType,
      entityId,
      actorUserId,
      occurredAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    };
    return paginate(
      (skip, take) =>
        this.prisma.db.auditLog.findMany({ where, orderBy: { occurredAt: "desc" }, skip, take }),
      () => this.prisma.db.auditLog.count({ where }),
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }
}
