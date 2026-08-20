import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { PipelineConfigService } from "./pipeline-config.service";
import { UpdatePipelineStageConfigDto } from "./dto/pipeline-config.dto";

/** feature 006 (pipeline configurável): 9 etapas do pipeline "developer", automático/manual, config global da plataforma. */
@ApiTags("pipeline-config")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("pipeline-stages")
export class PipelineConfigController {
  constructor(private readonly pipelineConfigService: PipelineConfigService) {}

  @Get()
  list() {
    return this.pipelineConfigService.list();
  }

  @Patch(":stage")
  @RequirePermission("PIPELINE_CONFIG_WRITE")
  update(@Param("stage") stage: string, @Body() dto: UpdatePipelineStageConfigDto) {
    return this.pipelineConfigService.updateMode(stage, dto.mode);
  }
}
