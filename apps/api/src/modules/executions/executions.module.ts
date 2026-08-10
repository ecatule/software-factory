import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { QueueModule } from "../../common/queue/queue.module";
import { SpecificationsModule } from "../specifications/specifications.module";
import { IncrementsModule } from "../increments/increments.module";
import { ExecutionsController } from "./executions.controller";
import { ExecutionsService } from "./executions.service";
import { ExecutionsProcessor } from "./executions.processor";
import { DeveloperAgentService } from "./developer-agent.service";

@Module({
  imports: [
    ProvidersModule,
    WorkflowsModule,
    QueueModule,
    SpecificationsModule,
    IncrementsModule,
  ],
  controllers: [ExecutionsController],
  providers: [ExecutionsService, ExecutionsProcessor, DeveloperAgentService],
  exports: [ExecutionsService, DeveloperAgentService],
})
export class ExecutionsModule {}
