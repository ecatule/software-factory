import { IsString } from "class-validator";

export class CreateSpecificationVersionDto {
  @IsString()
  content!: string;

  @IsString()
  reason!: string;
}
