import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { SpecificationsService } from "./specifications.service";
import { CreateSpecificationVersionDto } from "./dto/specification.dto";

@ApiTags("specifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("specifications")
export class SpecificationsController {
  constructor(private readonly specificationsService: SpecificationsService) {}

  @Get(":id/versions")
  listVersions(@Param("id") id: string) {
    return this.specificationsService.listVersions(id);
  }

  @Post(":id/versions")
  createVersion(@Param("id") id: string, @Body() dto: CreateSpecificationVersionDto) {
    return this.specificationsService.createVersion(id, dto);
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
