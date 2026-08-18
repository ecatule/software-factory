import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { DependencyAnalyzerSettingsService } from "./dependency-analyzer-settings.service";

class UpdateDependencyAnalyzerSettingsDto {
  @IsString()
  @MinLength(1)
  defaultBranch!: string;
}

@ApiTags("dependency-analyzer")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dependency-analyzer/settings")
export class DependencyAnalyzerSettingsController {
  constructor(private readonly settings: DependencyAnalyzerSettingsService) {}

  @Get()
  @RequirePermission("DEPENDENCY_ANALYZER_READ")
  get() {
    return this.settings.get();
  }

  @Patch()
  @RequirePermission("DEPENDENCY_ANALYZER_WRITE")
  update(@Body() dto: UpdateDependencyAnalyzerSettingsDto) {
    return this.settings.update(dto.defaultBranch);
  }
}
