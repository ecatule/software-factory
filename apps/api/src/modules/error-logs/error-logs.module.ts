import { Module } from "@nestjs/common";
import { ErrorLogsController } from "./error-logs.controller";

@Module({
  controllers: [ErrorLogsController],
})
export class ErrorLogsModule {}
