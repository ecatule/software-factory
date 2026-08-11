import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

/**
 * follow-up: Repository previously had no create endpoint at all — every
 * record had to be inserted directly in the database. `externalReference`
 * is the GitHub `owner/repo` slug (see GithubRepositoryProvider), the only
 * git address the Developer Agent needs to clone/branch/commit/PR.
 */
export class CreateRepositoryDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  externalReference!: string;

  @IsOptional()
  @IsString()
  productionBranch?: string;

  @IsOptional()
  @IsString()
  homologationBranch?: string;
}

/**
 * feature 004 (spec FR-002): Repository previously had no update endpoint at
 * all. follow-up: `externalReference` is now editable too — Repository is
 * the single place to manage a repo's address and both branches together,
 * previously only settable at creation with no way to fix a typo after.
 */
export class UpdateRepositoryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReference?: string;

  @IsOptional()
  @IsString()
  productionBranch?: string;

  @IsOptional()
  @IsString()
  homologationBranch?: string;
}
