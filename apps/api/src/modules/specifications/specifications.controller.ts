import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import type { JwtPayload } from "../identity/auth/jwt.strategy";
import { SpecificationsService } from "./specifications.service";
import {
  ApproveSpecificationVersionDto,
  CreateSpecificationVersionDto,
  UploadSpecificationVersionDto,
} from "./dto/specification.dto";

@ApiTags("specifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("specifications")
export class SpecificationsController {
  constructor(private readonly specificationsService: SpecificationsService) {}

  @Get(":id")
  get(@Param("id") id: string) {
    return this.specificationsService.get(id);
  }

  @Get(":id/versions")
  listVersions(@Param("id") id: string) {
    return this.specificationsService.listVersions(id);
  }

  @Post(":id/versions")
  @RequirePermission("SPECIFICATION_WRITE")
  createVersion(
    @Param("id") id: string,
    @Body() dto: CreateSpecificationVersionDto,
    @Req() req: Request,
  ) {
    return this.specificationsService.createVersion(id, dto, currentUserId(req));
  }

  /** feature 003 FR-024/FR-025: attach ready-made specify.md/plan.md instead of using the AI copilot. */
  @Post(":id/versions/upload")
  @RequirePermission("SPECIFICATION_WRITE")
  upload(@Param("id") id: string, @Body() dto: UploadSpecificationVersionDto) {
    return this.specificationsService.uploadVersion(id, dto);
  }

  /**
   * feature 003 FR-010–FR-013: no role restriction beyond authentication
   * (Clarifications 2026-08-09) — feature 004 FR-006 layers a specific
   * permission on top, granted to `admin` by default (FR-008), not a new
   * role restriction.
   */
  @Post(":id/versions/:versionId/approve")
  @RequirePermission("SPECIFICATION_APPROVE")
  approve(
    @Param("id") id: string,
    @Param("versionId", ParseIntPipe) versionNumber: number,
    @Body() dto: ApproveSpecificationVersionDto,
    @Req() req: Request,
  ) {
    return this.specificationsService.approve(id, versionNumber, dto, currentUserId(req));
  }

  @Get(":id/versions/:a/diff/:b")
  diff(
    @Param("id") id: string,
    @Param("a", ParseIntPipe) a: number,
    @Param("b", ParseIntPipe) b: number,
  ) {
    return this.specificationsService.diff(id, a, b);
  }

  @Post(":id/versions/:versionId/restore")
  restore(@Param("id") id: string, @Param("versionId", ParseIntPipe) versionNumber: number) {
    return this.specificationsService.restore(id, versionNumber);
  }
}

function currentUserId(req: Request): string | undefined {
  return (req.user as JwtPayload | undefined)?.sub;
}
