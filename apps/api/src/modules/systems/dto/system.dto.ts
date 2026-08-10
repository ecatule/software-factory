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
}

/** follow-up: bulk import — one row per spreadsheet line, parsed to JSON client-side. */
export class BulkCreateSystemArtifactsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSystemArtifactDto)
  artifacts!: CreateSystemArtifactDto[];
}
