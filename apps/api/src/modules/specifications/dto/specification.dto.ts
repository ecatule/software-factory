import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateSpecificationVersionDto {
  @IsString()
  content!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsUUID()
  incrementId?: string;

  @IsOptional()
  @IsIn(["HUMAN_EDITED", "UPLOADED"])
  source?: "HUMAN_EDITED" | "UPLOADED";
}

export class UploadSpecificationVersionDto {
  @IsOptional()
  @IsString()
  specifyMarkdown?: string;

  @IsOptional()
  @IsString()
  planMarkdown?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveSpecificationVersionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
