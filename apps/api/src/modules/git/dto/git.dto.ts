import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateCommitDto {
  @IsUUID()
  artifactId!: string;

  @IsString()
  message!: string;
}

export class CreatePullRequestDto {
  /** Omitted/empty = every eligible artifact (original behavior). */
  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  artifactIds?: string[];
}
