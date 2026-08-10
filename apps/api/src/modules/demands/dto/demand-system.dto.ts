import { IsArray, IsString } from "class-validator";

export class SetDemandSystemsDto {
  @IsArray()
  @IsString({ each: true })
  systemIds!: string[];
}

export class SetDemandSystemArtifactsDto {
  @IsArray()
  @IsString({ each: true })
  systemArtifactIds!: string[];
}

/** feature 005 FR-024: the current business/technical textarea content, sent as-is (see data-model.md). */
export class GeneratePromptSpecDto {
  @IsString()
  business!: string;

  @IsString()
  technical!: string;
}
