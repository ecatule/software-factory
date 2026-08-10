import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { SpecificationsModule } from "../specifications/specifications.module";
import { ArtifactsModule } from "../artifacts/artifacts.module";
import { IncrementsModule } from "../increments/increments.module";
import { ExecutionsModule } from "../executions/executions.module";
import { DemandsController } from "./demands.controller";
import { DemandsService } from "./demands.service";

@Module({
  imports: [
    ProvidersModule,
    WorkspacesModule,
    WorkflowsModule,
    SpecificationsModule,
    ArtifactsModule,
    IncrementsModule,
    ExecutionsModule,
  ],
  controllers: [DemandsController],
  providers: [DemandsService],
  exports: [DemandsService],
})
export class DemandsModule {}
