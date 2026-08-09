import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

export const EXECUTIONS_QUEUE = "executions";

/**
 * research.md §5: BullMQ on Redis backs AgentExecution processing
 * (API → Queue → Worker → Agent → Provider → Workspace), used starting in
 * Phase 4 (US2) and reused by the Developer Agent in Phase 8 (US6).
 */
@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    }),
    BullModule.registerQueue({ name: EXECUTIONS_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
