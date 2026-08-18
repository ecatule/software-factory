import { IsEnum, IsUUID } from "class-validator";
import { GmudEnvironment } from "@prisma/client";

export class CreateGmudRequestDto {
  @IsUUID()
  demandId!: string;

  @IsEnum(GmudEnvironment)
  environment!: GmudEnvironment;
}
