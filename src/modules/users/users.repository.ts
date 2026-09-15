import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { User, UserRow, mapUserRow } from '../../domain/types';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

export interface FindUsersResult {
  data: User[];
  total: number;
}

/**
 * Escapes a value for safe interpolation into a PostgREST filter string
 * (used by `.or()` below). PostgREST's own filter syntax is comma-separated
 * (`col.op.value,col.op.value`) and uses `.`, `(`, `)`, `*` as structural
 * characters — an unescaped user-supplied value containing any of these
 * changes which columns/operators are being filtered on, not just what
 * value they're compared against. PostgREST recognizes a backslash escape
 * for exactly this: prefixing `,`, `.`, `(`, `)`, and `\` itself with `\`.
 * `%`/`_` (ILIKE wildcards) are left alone — they're not structural to the
 * filter grammar, only to the pattern match itself, which is the intended
 * "contains" search behavior here.
 */
function escapePostgrestFilterValue(value: string): string {
  return value.replace(/[,.()\\]/g, (char) => `\\${char}`);
}

@Injectable()
export class UsersRepository {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * `customerId` is required — every query here is scoped to it, never a
   * plain `select *` across all customers. Without this, a deployment with
   * more than one `Customer` row would leak every customer's users into a
   * single `GET /api/v1/users` response, and `findById` could return a
   * user belonging to a different customer than the caller has access to
   * as long as they knew (or guessed) its internal UUID.
   */
  async findMany(
    customerId: string,
    query: ListUsersQueryDto,
  ): Promise<FindUsersResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    let builder = this.supabase
      .getClient()
      .from('users')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId);

    builder = query.includeDeleted ? builder : builder.is('deleted_at', null);

    if (query.company) {
      builder = builder.ilike('company_name', `%${query.company}%`);
    }
    if (query.status) {
      builder = builder.eq('status', query.status);
    }
    const search = query.search?.trim();
    if (search) {
      const pattern = `%${escapePostgrestFilterValue(search)}%`;
      builder = builder.or(
        [
          `name.ilike.${pattern}`,
          `email.ilike.${pattern}`,
          `external_user_id.ilike.${pattern}`,
          `company_name.ilike.${pattern}`,
          `company_industry.ilike.${pattern}`,
          `company_role.ilike.${pattern}`,
          `company_website.ilike.${pattern}`,
        ].join(','),
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await builder
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    return {
      data: ((data ?? []) as UserRow[]).map(mapUserRow),
      total: count ?? 0,
    };
  }

  async findById(customerId: string, id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('customer_id', customerId)
      .maybeSingle<UserRow>();
    if (error) {
      throw new Error(`Failed to look up user: ${error.message}`);
    }
    return data ? mapUserRow(data) : null;
  }
}
