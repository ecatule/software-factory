import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../../modules/identity/auth/jwt.strategy";

/**
 * follow-up: `AuditInterceptor` only ever writes on the SUCCESS path
 * (`.pipe(tap(...))`, no `error` branch) — a failed request left zero
 * trace anywhere but the ephemeral pino stdout log (live-observed: a GMUD
 * creation failure was undiagnosable without me starting the API process
 * myself to read its raw console). This is the first `APP_FILTER` in this
 * codebase (existing global providers are only `APP_GUARD`/`APP_INTERCEPTOR`).
 *
 * Extends Nest's own `BaseExceptionFilter` and delegates to it via
 * `super.catch()` after persisting — that's what already produces the
 * `context: "ExceptionsHandler"` pino error log seen in the console today;
 * hand-rolling the response here would risk silently losing that logging.
 * The HTTP response body is untouched by this filter — `HttpException`s
 * already carry safe, intentional messages (unchanged), and unexpected
 * errors keep Nest's generic 500 body rather than echoing internal detail
 * (SQL fragments, internal hosts, etc.) to whichever client triggered it.
 * Full detail only ever reaches `ErrorLog`, visible via `/error-logs`
 * (ERROR_LOG_READ permission) — not the response, not the toast.
 */
@Catch()
export class ErrorLogFilter extends BaseExceptionFilter {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest();
    const isHttp = exception instanceof HttpException;
    const { message, stack, exceptionName } = this.describe(exception);

    // best-effort — must never itself throw or block the response (same
    // swallow pattern as AuditInterceptor's audit-write failures).
    void this.prisma.db.errorLog
      .create({
        data: {
          method: request.method,
          url: request.originalUrl ?? request.url,
          statusCode: isHttp ? exception.getStatus() : 500,
          message,
          stack: stack ?? null,
          exceptionName,
          correlationId: request.id ?? request.headers?.["x-correlation-id"] ?? randomUUID(),
          actorUserId: (request.user as JwtPayload | undefined)?.sub ?? null,
          isHttpException: isHttp,
        },
      })
      .catch(() => {});

    super.catch(exception, host);
  }

  private describe(exception: unknown): { message: string; stack?: string; exceptionName?: string } {
    if (exception instanceof Error) {
      return { message: exception.message, stack: exception.stack, exceptionName: exception.constructor.name };
    }
    return { message: String(exception) };
  }
}
