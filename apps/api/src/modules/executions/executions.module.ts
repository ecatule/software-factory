import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { QueueModule } from "../../common/queue/queue.module";
import { SpecificationsModule } from "../specifications/specifications.module";
import { IncrementsModule } from "../increments/increments.module";
// follow-up: GitModule (needed here so ExecutionsProcessor can auto-commit
// after `implement`) itself needs DeveloperAgentModule, not this module —
// importing GitModule directly would be circular (GitModule used to import
// ExecutionsModule just for DeveloperAgentService).
import { GitModule } from "../git/git.module";
import { QaModule } from "../qa/qa.module";
import { PipelineConfigModule } from "../pipeline-config/pipeline-config.module";
import { DeveloperAgentModule } from "./developer-agent.module";
import { ExecutionsController } from "./executions.controller";
import { ExecutionsService } from "./executions.service";
import { ExecutionsProcessor } from "./executions.processor";

@Module({
  imports: [
    ProvidersModule,
    WorkflowsModule,
    QueueModule,
    SpecificationsModule,
    IncrementsModule,
    DeveloperAgentModule,
    GitModule,
    QaModule,
    PipelineConfigModule,
  ],
  controllers: [ExecutionsController],
  providers: [ExecutionsService, ExecutionsProcessor],
  exports: [ExecutionsService, DeveloperAgentModule],
})
export class ExecutionsModule {}
