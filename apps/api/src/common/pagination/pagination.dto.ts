import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * spec 002 SC-007: every list endpoint enforces this cap server-side —
 * a client cannot defeat pagination by requesting an unbounded page_size.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  page_size?: number = DEFAULT_PAGE_SIZE;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
