# Prisma migrations

Migrations for `apps/api/prisma/schema.prisma` are generated here via
`pnpm --filter @software-factory/api exec prisma migrate dev`.

## Mandatory base columns (constitution: Technology & Data Standards)

Every model in `schema.prisma` MUST declare these columns, in this order, so every table in
the database carries them uniformly:

```prisma
model Example {
  id         String    @id @default(uuid()) @db.Uuid
  stAtivo    Boolean   @default(true) @map("st_ativo")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")
  deletedAt  DateTime? @map("deleted_at")
  createdBy  String?   @map("created_by") @db.Uuid
  updatedBy  String?   @map("updated_by") @db.Uuid
  version    Int       @default(1)

  // ...entity-specific fields below...

  @@map("examples")
}
```

- `id` is always a UUID primary key.
- `deletedAt` is the soft-delete marker; physical `DELETE` is never issued by application
  code — see `apps/api/src/common/prisma/soft-delete.extension.ts`, which intercepts
  `delete`/`deleteMany` calls on the Prisma Client and converts them into an update that sets
  `deletedAt` (and `stAtivo = false`) instead.
- `version` is used for optimistic locking: updates should include a `WHERE version = :version`
  condition and increment `version` in the same statement; a mismatch means the row changed
  concurrently (see spec.md Edge Cases — concurrent specification edits).
- `createdBy`/`updatedBy` reference `User.id` but are nullable to allow system/agent-driven
  writes that aren't attributable to a human user.
