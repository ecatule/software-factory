import { Module } from "@nestjs/common";
import { IncrementsService } from "./increments.service";

@Module({
  providers: [IncrementsService],
  exports: [IncrementsService],
})
export class IncrementsModule {}
