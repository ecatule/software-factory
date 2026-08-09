import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";

/**
 * spec 002 FR-026: cross-demand branches/commits — 001 only had per-demand
 * views. Pull request listing lives on `PullRequestsController` instead,
 * alongside its existing single-item `GET /pull-requests/:id`.
 */
@ApiTags("git")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class GitActivityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("branches")
  branches(
    @Query("repository_id") repositoryId?: string,
    @Query("demand_id") demandId?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    const where: Prisma.BranchWhereInput = { repositoryId, demandId };
    return paginate(
      (skip, take) =>
        this.prisma.db.branch.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      () => this.prisma.db.branch.count({ where }),
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Get("commits")
  async commits(
    @Query("repository_id") repositoryId?: string,
    @Query("demand_id") demandId?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    // Commit only has a scalar branchId (no Prisma relation to Branch), so a
    // repository filter is resolved as a two-step lookup rather than a
    // nested `where` — no schema change needed for this feature.
    let branchIds: string[] | undefined;
    if (repositoryId) {
      const branches = await this.prisma.db.branch.findMany({
        where: { repositoryId },
        select: { id: true },
      });
      branchIds = branches.map((b) => b.id);
    }
    const where: Prisma.CommitWhereInput = {
      demandId,
      branchId: branchIds ? { in: branchIds } : undefined,
    };
    return paginate(
      (skip, take) =>
        this.prisma.db.commit.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      () => this.prisma.db.commit.count({ where }),
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }
}
