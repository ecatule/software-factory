import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export enum DemandTypeDto {
  BUG = "BUG",
  FEATURE = "FEATURE",
  IMPROVEMENT = "IMPROVEMENT",
  TASK = "TASK",
  TECHNICAL_DEBT = "TECHNICAL_DEBT",
}

export class CreateDemandDto {
  @IsString()
  externalId!: string;

  @IsString()
  origin!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsEnum(DemandTypeDto)
  type!: DemandTypeDto;

  @IsString()
  priority!: string;

  @IsUUID()
  clientId!: string;

  @IsUUID()
  projectId!: string;
}

export class UpdateDemandDto {
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class TransitionDemandDto {
  @IsString()
  toStage!: string;
}
