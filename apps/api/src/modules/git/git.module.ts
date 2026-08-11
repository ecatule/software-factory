import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { DeveloperAgentModule } from "../executions/developer-agent.module";
import { GitController } from "./git.controller";
import { PullRequestsController } from "./pull-requests.controller";
import { GitActivityController } from "./git-activity.controller";
import { GitService } from "./git.service";

@Module({
  imports: [ProvidersModule, DeveloperAgentModule],
  controllers: [GitController, PullRequestsController, GitActivityController],
  providers: [GitService],
  exports: [GitService],
})
export class GitModule {}
