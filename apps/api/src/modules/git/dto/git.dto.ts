import { IsString, IsUUID } from "class-validator";

export class CreateCommitDto {
  @IsUUID()
  artifactId!: string;

  @IsString()
  message!: string;
}
