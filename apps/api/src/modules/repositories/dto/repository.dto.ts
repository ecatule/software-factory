import { IsOptional, IsString } from "class-validator";

/** feature 004 (spec FR-002): Repository previously had no update endpoint at all. */
export class UpdateRepositoryDto {
  @IsOptional()
  @IsString()
  productionBranch?: string;

  @IsOptional()
  @IsString()
  homologationBranch?: string;
}
