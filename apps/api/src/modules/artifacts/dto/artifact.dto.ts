import { IsArray, IsEnum, IsOptional, IsString, ValidateIf } from "class-validator";

export class CreateArtifactDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  technology?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsArray()
  repositoryIds?: string[];
}

export class UpdateArtifactDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  path?: string;
}

export enum ArtifactFileChangeTypeDto {
  MODIFIED = "MODIFIED",
  ADDED = "ADDED",
  REMOVED = "REMOVED",
  DISCOVERED = "DISCOVERED",
}

export class CreateArtifactFileDto {
  @IsString()
  filePath!: string;

  @IsEnum(ArtifactFileChangeTypeDto)
  changeType!: ArtifactFileChangeTypeDto;

  // spec FR-017: a justification is required whenever a file is discovered
  // outside the originally planned scope.
  @ValidateIf((dto: CreateArtifactFileDto) => dto.changeType === ArtifactFileChangeTypeDto.DISCOVERED)
  @IsString()
  reason?: string;
}
