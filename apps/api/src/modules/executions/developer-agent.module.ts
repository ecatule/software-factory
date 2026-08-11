import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { DeveloperAgentService } from "./developer-agent.service";

/**
 * follow-up: split out of ExecutionsModule so GitModule (which needs
 * DeveloperAgentService to locate a demand's clones) and ExecutionsModule
 * (which needs GitService to auto-commit after `implement`) can each depend
 * on this without a circular module import between the two.
 */
@Module({
  imports: [ProvidersModule],
  providers: [DeveloperAgentService],
  exports: [DeveloperAgentService],
})
export class DeveloperAgentModule {}
