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

  /**
   * feature 004 FR-001 (live-validation finding): these 4 fields were wired
   * into the frontend edit form (T012) but never added here, so
   * ValidationPipe's `whitelist: true` silently stripped them on every save.
   */
  @IsOptional()
  @IsString()
  productionBranch?: string;

  @IsOptional()
  @IsString()
  homologationBranch?: string;

  @IsOptional()
  @IsString()
  homologationEnvironment?: string;

  @IsOptional()
  @IsString()
  productionEnvironment?: string;
}
