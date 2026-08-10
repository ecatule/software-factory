import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/** feature 004 (spec FR-006): finer-grained than @Roles(), checked by RbacGuard alongside it. */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
