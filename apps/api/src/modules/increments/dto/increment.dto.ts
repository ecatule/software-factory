import { IsOptional, IsString } from "class-validator";

export class CreateIncrementDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  title?: string;
}
