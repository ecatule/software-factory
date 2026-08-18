import { IsOptional, IsString } from "class-validator";

export class CreateClientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  mondayClientLabel?: string;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  mondayClientLabel?: string;
}
