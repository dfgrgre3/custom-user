import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * `@Type(() => Boolean)` alone is unsafe for query strings: JS's `Boolean()`
 * coerces any non-empty string — including the literal string "false" — to
 * `true`. That would make `?includeDeleted=false` behave like `=true`. This
 * only treats the strings "true"/"false" (any case) as booleans; anything
 * else fails validation via @IsBoolean() instead of silently being true.
 */
function toBoolean({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive filter on company name.',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    description:
      'Case-insensitive match against name, email, external id, company, industry, role, or website.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['active', 'invited', 'suspended'] })
  @IsOptional()
  @IsIn(['active', 'invited', 'suspended'])
  status?: string;

  @ApiPropertyOptional({
    description:
      'Include users no longer present in the customer dataset. Default: false.',
    default: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
