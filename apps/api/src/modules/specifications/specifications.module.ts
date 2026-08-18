import { Module } from "@nestjs/common";
import { IncrementsModule } from "../increments/increments.module";
import { DependencyAnalyzerModule } from "../dependency-analyzer/dependency-analyzer.module";
import { SpecificationsController } from "./specifications.controller";
import { SpecificationsService } from "./specifications.service";
import { SpecificationContextService } from "./specification-context.service";

@Module({
  imports: [IncrementsModule, DependencyAnalyzerModule],
  controllers: [SpecificationsController],
  providers: [SpecificationsService, SpecificationContextService],
  exports: [SpecificationsService, SpecificationContextService],
})
export class SpecificationsModule {}
