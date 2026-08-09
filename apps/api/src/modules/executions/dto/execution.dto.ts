import { IsOptional, IsString, IsUUID } from "class-validator";

export class CreateExecutionDto {
  @IsUUID()
  agentId!: string;

  @IsUUID()
  demandId!: string;

  @IsOptional()
  @IsUUID()
  providerConfigurationId?: string;

  @IsOptional()
  @IsString()
  pipelineStage?: string;
}
