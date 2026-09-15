import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { Customer, CustomerRow, mapCustomerRow } from '../../domain/types';

/**
 * Owns customer identity. For this assessment there is one customer,
 * configured through environment variables, but callers (sync, users)
 * never assume that — they always go through a `Customer` row so that
 * adding a second customer later is a data change, not a code change.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns the configured default customer, creating its row on first use.
   *
   * Uses a single `upsert` on the `customers.name` unique constraint rather
   * than "select, then insert if missing": the latter has a race window
   * where two concurrent calls can both see "not found" and both insert,
   * producing a duplicate `Customer` row for the same name.
   */
  async getOrCreateDefaultCustomer(): Promise<Customer> {
    const name = this.config.get<string>('app.customer.name')!;
    const apiBaseUrl = this.config.get<string>('app.customer.apiBaseUrl')!;
    const client = this.supabase.getClient();

    const { data: upserted, error } = await client
      .from('customers')
      .upsert({ name, api_base_url: apiBaseUrl }, { onConflict: 'name' })
      .select('*')
      .single<CustomerRow>();
    if (error || !upserted) {
      throw new Error(`Failed to upsert customer: ${error?.message}`);
    }
    return mapCustomerRow(upserted);
  }

  async findById(id: string): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle<CustomerRow>();
    if (error) {
      throw new Error(`Failed to look up customer: ${error.message}`);
    }
    return data ? mapCustomerRow(data) : null;
  }
}
