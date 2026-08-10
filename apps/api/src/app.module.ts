import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./common/prisma/prisma.module";
import { LoggingModule } from "./common/logging/logging.module";
import { QueueModule } from "./common/queue/queue.module";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { RbacGuard } from "./modules/identity/guards/rbac.guard";
import { JwtAuthGuard } from "./modules/identity/auth/jwt-auth.guard";
import { AuthModule } from "./modules/identity/auth/auth.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { DemandsModule } from "./modules/demands/demands.module";
import { ExecutionsModule } from "./modules/executions/executions.module";
import { SpecificationsModule } from "./modules/specifications/specifications.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";
import { ArtifactsModule } from "./modules/artifacts/artifacts.module";
import { TestsModule } from "./modules/tests/tests.module";
import { GitModule } from "./modules/git/git.module";
import { AuditModule } from "./modules/audit/audit.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { AgentsModule } from "./modules/agents/agents.module";
import { RepositoriesModule } from "./modules/repositories/repositories.module";
import { TechnologiesModule } from "./modules/technologies/technologies.module";
import { IncrementsModule } from "./modules/increments/increments.module";
import { RolesModule } from "./modules/roles/roles.module";

@Module({
  imports: [
    LoggingModule,
    PrismaModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    QueueModule,
    AuthModule,
    ClientsModule,
    ProjectsModule,
    DemandsModule,
    ExecutionsModule,
    SpecificationsModule,
    WorkspacesModule,
    ArtifactsModule,
    TestsModule,
    GitModule,
    AuditModule,
    DashboardModule,
    AgentsModule,
    RepositoriesModule,
    TechnologiesModule,
    IncrementsModule,
    RolesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // JwtAuthGuard MUST run before RbacGuard: global guards run in
    // registration order, and RbacGuard has no way to authenticate a
    // request on its own — it only checks roles on an already-populated
    // request.user (see rbac.guard.ts).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
