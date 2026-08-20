import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { PrismaService } from "../../common/prisma/prisma.service";
import { GitService } from "./git.service";
import { CreateCommitDto, CreatePullRequestDto, PushPendingCommitsDto } from "./dto/git.dto";

@ApiTags("git")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("demands/:demandId")
export class GitController {
  constructor(
    private readonly gitService: GitService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("branch")
  @RequirePermission("GIT_WRITE")
  createBranch(@Param("demandId") demandId: string) {
    return this.gitService.createBranch(demandId);
  }

  @Post("commit")
  @RequirePermission("GIT_WRITE")
  commit(@Param("demandId") demandId: string, @Body() dto: CreateCommitDto) {
    return this.gitService.commit(demandId, dto.artifactId, dto.message);
  }

  @Post("commit-all")
  @RequirePermission("GIT_WRITE")
  commitAll(@Param("demandId") demandId: string) {
    return this.gitService.commitAllArtifacts(demandId);
  }

  @Post("pull-request")
  @RequirePermission("PR_CREATE")
  createPullRequest(@Param("demandId") demandId: string, @Body() dto: CreatePullRequestDto) {
    return this.gitService.createPullRequest(demandId, dto.artifactIds);
  }

  /** read-only — asks each artifact's local clone whether it's ahead of origin (see GitService.getUnpushedCommits). */
  @Get("git/unpushed")
  getUnpushedCommits(@Param("demandId") demandId: string) {
    return this.gitService.getUnpushedCommits(demandId);
  }

  @Post("git/push")
  @RequirePermission("GIT_WRITE")
  pushPendingCommits(@Param("demandId") demandId: string, @Body() dto: PushPendingCommitsDto) {
    return this.gitService.pushPendingCommits(demandId, dto.artifactIds);
  }

  /** spec User Story 9: branch/commits/PR/checks visible per demand. */
  @Get("git")
  async gitActivity(@Param("demandId") demandId: string) {
    const [branches, commits, pullRequests] = await Promise.all([
      this.prisma.db.branch.findMany({ where: { demandId } }),
      this.prisma.db.commit.findMany({ where: { demandId } }),
      this.prisma.db.pullRequest.findMany({ where: { demandId } }),
    ]);
    const repositoryIds = [...new Set(branches.map((b) => b.repositoryId))];
    const repositories = await this.prisma.db.repository.findMany({
      where: { id: { in: repositoryIds } },
    });
    return { repositories, branches, commits, pull_requests: pullRequests };
  }
}
