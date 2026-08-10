import { Module } from "@nestjs/common";
import { SystemsController } from "./systems.controller";
import { SystemsService } from "./systems.service";

@Module({
  controllers: [SystemsController],
  providers: [SystemsService],
  exports: [SystemsService],
})
export class SystemsModule {}
