import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SearchQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class PageQuery extends SearchQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" matcher, or undefined for an empty query. */
export const containsRegex = (q?: string) => (q?.trim() ? new RegExp(escapeRegex(q.trim()), 'i') : undefined);
