import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { QaGenerationService } from "./qa-generation.service";
import { EnvironmentGuard } from "./environment-guard.service";
import { QaExecutionService } from "./qa-execution.service";
import { QaController } from "./qa.controller";

/**
 * feature 006: o Agente QA (Agent.type = "qa") não é um worker/fila
 * separado — QaGenerationService é chamado pelo ExecutionsProcessor
 * (ExecutionsModule) dentro da MESMA AgentExecution do tipo "developer",
 * entre `implement` e `commit` (research.md §3/§4).
 */
@Module({
  imports: [ProvidersModule, WorkflowsModule],
  controllers: [QaController],
  providers: [QaGenerationService, EnvironmentGuard, QaExecutionService],
  exports: [QaGenerationService, EnvironmentGuard, QaExecutionService],
})
export class QaModule {}
