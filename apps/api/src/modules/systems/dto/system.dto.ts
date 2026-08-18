import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateSystemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSystemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  stAtivo?: boolean;
}

export class CreateSystemArtifactDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  technology?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // follow-up: links this catalog artifact to real Repository row(s) —
  // entered once here, reused by every demand that later selects this
  // SystemArtifact (see DemandsService.ensureArtifactsForSystemArtifacts).
  @IsOptional()
  @IsArray()
  repositoryIds?: string[];
}

export class UpdateSystemArtifactDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  technology?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  stAtivo?: boolean;

  @IsOptional()
  @IsArray()
  repositoryIds?: string[];
}

/** follow-up: bulk import — one row per spreadsheet line, parsed to JSON client-side. */
export class BulkCreateSystemArtifactsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSystemArtifactDto)
  artifacts!: CreateSystemArtifactDto[];
}

/** follow-up: "todos os artefatos precisam ter um repositório linked" — bulk-link every active artifact of a Sistema that currently has none. */
export class LinkRepositoryToUnlinkedArtifactsDto {
  @IsString()
  repositoryId!: string;
}
