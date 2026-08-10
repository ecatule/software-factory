import { IsObject, IsOptional, IsString, IsUUID } from "class-validator";

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

  /** feature 003 (research.md §11): the human input for an AI round, persisted verbatim. */
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}
