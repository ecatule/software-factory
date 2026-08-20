import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";

@ApiTags("error-logs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("error-logs")
export class ErrorLogsController {
  constructor(private readonly prisma: PrismaService) {}

  /** written by the global ErrorLogFilter — see error-log.filter.ts. */
  @Get()
  @RequirePermission("ERROR_LOG_READ")
  list(
    @Query("method") method?: string,
    @Query("status_code") statusCode?: string,
    @Query("correlation_id") correlationId?: string,
    @Query("actor_user_id") actorUserId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    const where: Prisma.ErrorLogWhereInput = {
      method,
      correlationId,
      actorUserId,
      statusCode: statusCode ? Number(statusCode) : undefined,
      occurredAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    };
    return paginate(
      (skip, take) =>
        this.prisma.db.errorLog.findMany({ where, orderBy: { occurredAt: "desc" }, skip, take }),
      () => this.prisma.db.errorLog.count({ where }),
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }
}
