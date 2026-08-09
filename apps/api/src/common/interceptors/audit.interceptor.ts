import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../../modules/identity/auth/jwt.strategy";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * spec FR-025: writes an AuditLog row for every critical (write) operation.
 * Applied globally so no module can skip auditing by omission — individual
 * controllers don't need to remember to call an audit service themselves.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method;

    if (!WRITE_METHODS.has(method)) {
      return next.handle();
    }

    const user = request.user as JwtPayload | undefined;
    const correlationId: string = request.headers["x-correlation-id"] ?? randomUUID();
    const [entityType, entityId] = this.inferEntity(request.url);

    return next.handle().pipe(
      tap((result) => {
        void this.prisma.db.auditLog
          .create({
            data: {
              actorUserId: user?.sub ?? null,
              action: method,
              entityType,
              entityId: entityId ?? this.tryExtractId(result),
              after: this.safeJson(result),
              correlationId,
            },
          })
          .catch(() => {
            // Auditing must never break the primary request flow; failures are
            // swallowed here and should be alerted on via logs/metrics instead.
          });
      }),
    );
  }

  private inferEntity(url: string): [string, string | null] {
    const segments = url.split("?")[0].split("/").filter(Boolean);
    const resourceIndex = segments.indexOf("v1") + 1;
    const entityType = segments[resourceIndex] ?? "unknown";
    const entityId = segments[resourceIndex + 1] ?? null;
    return [entityType, entityId];
  }

  private tryExtractId(result: unknown): string | null {
    if (result && typeof result === "object" && "id" in result) {
      return String((result as { id: unknown }).id);
    }
    return null;
  }

  private safeJson(value: unknown) {
    try {
      return JSON.parse(JSON.stringify(value ?? {}));
    } catch {
      return {};
    }
  }
}
