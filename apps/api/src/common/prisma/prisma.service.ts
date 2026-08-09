import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { softDeleteGuardExtension } from "./soft-delete.extension";

function buildExtendedClient() {
  return new PrismaClient().$extends(softDeleteGuardExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof buildExtendedClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /** Renamed from `client` to `db` to avoid colliding with the `Client` domain model. */
  readonly db: ExtendedPrismaClient = buildExtendedClient();

  async onModuleInit() {
    await (this.db as unknown as PrismaClient).$connect();
  }

  async onModuleDestroy() {
    await (this.db as unknown as PrismaClient).$disconnect();
  }
}
