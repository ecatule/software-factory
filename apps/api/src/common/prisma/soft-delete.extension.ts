import { Prisma } from "@prisma/client";

/**
 * Constitution (Banco de Dados): "Delete físico é proibido" — physical delete is forbidden.
 *
 * This extension intercepts every `delete`/`deleteMany` call issued through the extended
 * Prisma Client and rejects it. Callers MUST perform a soft delete instead, i.e. an
 * `update`/`updateMany` that sets `deletedAt` (and `stAtivo = false`). This makes the rule a
 * technical guarantee rather than a convention developers must remember to follow.
 */
export const softDeleteGuardExtension = Prisma.defineExtension({
  name: "soft-delete-guard",
  query: {
    $allModels: {
      delete() {
        throw new Error(
          "Physical delete is forbidden by the project constitution. " +
            "Use a soft-delete update (set deletedAt/stAtivo) instead of Prisma's delete().",
        );
      },
      deleteMany() {
        throw new Error(
          "Physical delete is forbidden by the project constitution. " +
            "Use a soft-delete update (set deletedAt/stAtivo) instead of Prisma's deleteMany().",
        );
      },
    },
  },
});
