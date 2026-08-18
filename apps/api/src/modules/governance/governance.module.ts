import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { DemandsModule } from "../demands/demands.module";
import { GmudRequestsController } from "./gmud-requests.controller";
import { GmudRequestsService } from "./gmud-requests.service";

@Module({
  imports: [ProvidersModule, DemandsModule],
  controllers: [GmudRequestsController],
  providers: [GmudRequestsService],
})
export class GovernanceModule {}
