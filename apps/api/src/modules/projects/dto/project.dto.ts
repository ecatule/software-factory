import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";

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

  /** feature 006 (spec FR-008/FR-009): padrão desabilitada — controlada por Prisma @default(false), não aqui. */
  @IsOptional()
  @IsBoolean()
  qaAutoExecutionEnabled?: boolean;
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

  /** feature 006 (spec FR-008/FR-009): alterar esta configuração é sempre uma ação explícita deste formulário — nenhuma outra ação do sistema muda esse valor como efeito colateral. */
  @IsOptional()
  @IsBoolean()
  qaAutoExecutionEnabled?: boolean;
}
