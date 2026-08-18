import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

export const EXECUTIONS_QUEUE = "executions";
export const DEPENDENCY_ANALYSIS_QUEUE = "dependency-analysis";

/**
 * research.md §5: BullMQ on Redis backs AgentExecution processing
 * (API → Queue → Worker → Agent → Provider → Workspace), used starting in
 * Phase 4 (US2) and reused by the Developer Agent in Phase 8 (US6).
 */
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
        // Without these, an unreachable Redis makes queue.add() (and thus
        // POST /executions) hang indefinitely instead of failing — ioredis
        // otherwise retries forever with no connection timeout.
        connectTimeout: 5000,
        maxRetriesPerRequest: 2,
      },
    }),
    BullModule.registerQueue({ name: EXECUTIONS_QUEUE }),
    BullModule.registerQueue({ name: DEPENDENCY_ANALYSIS_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
