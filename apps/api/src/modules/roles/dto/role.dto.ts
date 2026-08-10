import { IsString } from "class-validator";

export class SetRolePermissionsDto {
  @IsString({ each: true })
  permissionNames!: string[];
}
