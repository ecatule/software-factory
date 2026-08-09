import { Module } from "@nestjs/common";
import { ArtifactsController, DemandArtifactsController } from "./artifacts.controller";
import { ArtifactsService } from "./artifacts.service";

@Module({
  controllers: [ArtifactsController, DemandArtifactsController],
  providers: [ArtifactsService],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
