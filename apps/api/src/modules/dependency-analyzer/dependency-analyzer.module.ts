import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { QueueModule } from "../../common/queue/queue.module";
import { DependencyAnalyzerController } from "./dependency-analyzer.controller";
import { DependencyAnalyzerSettingsController } from "./dependency-analyzer-settings.controller";
import { DependencyAnalyzerBulkController } from "./dependency-analyzer-bulk.controller";
import { DependencyAnalyzerService } from "./dependency-analyzer.service";
import { DependencyAnalyzerSettingsService } from "./dependency-analyzer-settings.service";
import { DependencyAnalysisRunsService } from "./dependency-analysis-runs.service";
import { DependencyAnalysisProcessor } from "./dependency-analysis.processor";
import { Neo4jDependencyRepository } from "./neo4j-dependency.repository";

@Module({
  imports: [ProvidersModule, QueueModule],
  controllers: [DependencyAnalyzerController, DependencyAnalyzerSettingsController, DependencyAnalyzerBulkController],
  providers: [
    DependencyAnalyzerService,
    DependencyAnalyzerSettingsService,
    DependencyAnalysisRunsService,
    DependencyAnalysisProcessor,
    Neo4jDependencyRepository,
  ],
  exports: [DependencyAnalyzerService],
})
export class DependencyAnalyzerModule {}
