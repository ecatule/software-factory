import type { PaginatedResult } from "./pagination.dto";

const MAX_PAGE_SIZE = 100;

/**
 * Runs a `findMany` + `count` pair (both already filtered/scoped by the
 * caller) and wraps them in the shared `{items,total,page,page_size}`
 * envelope (data-model.md) — used by every new/extended list endpoint in
 * this feature.
 *
 * spec 002 SC-007: `pageSize` is clamped here, centrally, so every call site
 * enforces the cap automatically — a client cannot defeat pagination by
 * requesting an unbounded `page_size` on any endpoint that goes through
 * this helper (verified: T091's cross-cutting check found none of the
 * controllers were enforcing this themselves before this fix).
 */
export async function paginate<T>(
  findMany: (skip: number, take: number) => Promise<T[]>,
  count: () => Promise<number>,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResult<T>> {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize) || 20));
  const skip = (safePage - 1) * safePageSize;
  const [items, total] = await Promise.all([findMany(skip, safePageSize), count()]);
  return { items, total, page: safePage, page_size: safePageSize };
}
