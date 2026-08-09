import { IsObject, IsOptional, IsString } from "class-validator";

export class CreateProviderConfigurationDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  pipelineStage?: string;

  @IsObject()
  settings!: Record<string, unknown>;
}
