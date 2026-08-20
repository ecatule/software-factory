import { Module } from "@nestjs/common";
import { PipelineConfigController } from "./pipeline-config.controller";
import { PipelineConfigService } from "./pipeline-config.service";

@Module({
  controllers: [PipelineConfigController],
  providers: [PipelineConfigService],
  exports: [PipelineConfigService],
})
export class PipelineConfigModule {}
