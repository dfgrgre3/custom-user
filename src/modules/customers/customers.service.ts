import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /** Returns the configured default customer, creating its row on first use. */
  async getOrCreateDefaultCustomer(): Promise<Customer> {
    const name = this.config.get<string>('app.customer.name')!;
    const apiBaseUrl = this.config.get<string>('app.customer.apiBaseUrl')!;
    const client = this.supabase.getClient();

    const { data: existing, error: findError } = await client
      .from('customers')
      .select('*')
      .eq('name', name)
      .maybeSingle<CustomerRow>();
    if (findError) {
      throw new Error(`Failed to look up customer: ${findError.message}`);
    }

    if (existing) {
      if (existing.api_base_url !== apiBaseUrl) {
        const { data: updated, error: updateError } = await client
          .from('customers')
          .update({ api_base_url: apiBaseUrl })
          .eq('id', existing.id)
          .select('*')
          .single<CustomerRow>();
        if (updateError || !updated) {
          throw new Error(`Failed to update customer: ${updateError?.message}`);
        }
        return mapCustomerRow(updated);
      }
      return mapCustomerRow(existing);
    }

    this.logger.log(`Creating customer record for "${name}"`);
    const { data: created, error: createError } = await client
      .from('customers')
      .insert({ name, api_base_url: apiBaseUrl })
      .select('*')
      .single<CustomerRow>();
    if (createError || !created) {
      throw new Error(`Failed to create customer: ${createError?.message}`);
    }
    return mapCustomerRow(created);
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
