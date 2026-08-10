import { IsArray, IsString } from "class-validator";

export class SetClientSystemsDto {
  @IsArray()
  @IsString({ each: true })
  systemIds!: string[];
}
