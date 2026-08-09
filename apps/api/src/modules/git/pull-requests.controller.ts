import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { CODE_REPOSITORY_PROVIDER, type CodeRepositoryProvider } from "@software-factory/domain";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";

@ApiTags("pull-requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("pull-requests")
export class PullRequestsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CODE_REPOSITORY_PROVIDER)
    private readonly codeRepositoryProvider: CodeRepositoryProvider,
  ) {}

  /** spec 002 FR-026/contracts/console-lists.md: cross-demand PR listing. */
  @Get()
  list(
    @Query("repository_id") repositoryId?: string,
    @Query("demand_id") demandId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    const where: Prisma.PullRequestWhereInput = { repositoryId, demandId, status };
    return paginate(
      (skip, take) =>
        this.prisma.db.pullRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      () => this.prisma.db.pullRequest.count({ where }),
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const pullRequest = await this.prisma.db.pullRequest.findUniqueOrThrow({ where: { id } });
    const repository = await this.prisma.db.repository.findUniqueOrThrow({
      where: { id: pullRequest.repositoryId },
    });
    const checks = await this.codeRepositoryProvider.getChecks(
      repository.externalReference,
      pullRequest.externalReference,
    );
    return { ...pullRequest, checks };
  }
}
