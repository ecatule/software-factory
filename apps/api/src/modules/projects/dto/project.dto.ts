import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateProjectDto {
  @IsUUID()
  clientId!: string;

  @IsString()
  name!: string;

  @IsArray()
  @IsOptional()
  technologies?: string[];

  @IsArray()
  @IsOptional()
  requiredTestSuites?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  technologies?: string[];

  @IsOptional()
  @IsString()
  branchNamingPolicy?: string;

  @IsOptional()
  @IsArray()
  requiredTestSuites?: string[];

  /** follow-up: per-project `.specify/memory/constitution.md` content, applied to every demand's workspace before any SDD stage runs. */
  @IsOptional()
  @IsString()
  constitution?: string;
}
