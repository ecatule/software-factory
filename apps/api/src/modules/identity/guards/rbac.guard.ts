import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import type { JwtPayload } from "../auth/jwt.strategy";

/**
 * spec FR-026: restricts access to demands, specifications, workspaces, and
 * administrative functions according to the acting user's role. Runs after
 * JwtAuthGuard, which populates `request.user`.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // feature 004 (spec FR-006/FR-007): finer-grained than @Roles(), checked
    // independently — an endpoint may use either, both, or neither.
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const hasRoleRequirement = requiredRoles && requiredRoles.length > 0;
    const hasPermissionRequirement = requiredPermissions && requiredPermissions.length > 0;
    if (!hasRoleRequirement && !hasPermissionRequirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      throw new ForbiddenException("No authenticated user on request");
    }

    if (hasRoleRequirement) {
      const hasRole = requiredRoles.some((role) => user.roles?.includes(role));
      if (!hasRole) {
        throw new ForbiddenException(
          `Requires one of roles [${requiredRoles.join(", ")}]`,
        );
      }
    }

    if (hasPermissionRequirement) {
      const hasPermission = requiredPermissions.every((permission) =>
        user.permissions?.includes(permission),
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          `Requires permission(s) [${requiredPermissions.join(", ")}]`,
        );
      }
    }

    return true;
  }
}
