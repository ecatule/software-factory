import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { SpecificationsModule } from "../specifications/specifications.module";
import { ArtifactsModule } from "../artifacts/artifacts.module";
import { IncrementsModule } from "../increments/increments.module";
import { DemandsController } from "./demands.controller";
import { DemandsService } from "./demands.service";
import { PromptSpecService } from "./prompt-spec.service";

@Module({
  imports: [
    ProvidersModule,
    WorkspacesModule,
    WorkflowsModule,
    SpecificationsModule,
    ArtifactsModule,
    IncrementsModule,
  ],
  controllers: [DemandsController],
  providers: [DemandsService, PromptSpecService],
  exports: [DemandsService],
})
export class DemandsModule {}
