import { Module } from "@nestjs/common";
import { TestsController } from "./tests.controller";
import { TestRunnerService } from "./test-runner.service";

@Module({
  controllers: [TestsController],
  providers: [TestRunnerService],
  exports: [TestRunnerService],
})
export class TestsModule {}
