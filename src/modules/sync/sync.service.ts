import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncInProgressError } from '../../common/errors/errors';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { CustomerApiClient } from '../../integrations/customer-api/customer-api.client';
import { CustomerApiError } from '../../integrations/customer-api/customer-api.errors';
import { mapExternalUserToSyncedUserData } from '../../integrations/customer-api/customer-api.mapper';
import { CustomersService } from '../customers/customers.service';
import { SyncRun, SyncRunRow, mapSyncRunRow } from '../../domain/types';

/**
 * Orchestrates one synchronization run for one customer:
 *
 *   1. Fetch the *complete* external dataset (all pages) before touching
 *      the database — a failure here leaves previously synced data intact.
 *   2. Map every external user into our internal representation.
 *   3. Atomically (via the `sync_users` Postgres function): upsert every
 *      fetched user (by (customerId, externalUserId)), then soft-delete
 *      any previously synced, still-active user that was NOT in this
 *      fetch. This used to be a Prisma `$transaction`; the Supabase JS
 *      client has no client-side multi-statement transaction API, so the
 *      atomic step now lives in a database function (see
 *      supabase/schema.sql) invoked with a single `.rpc()` call.
 *   4. Record the SyncRun outcome.
 *
 * Running the same fetch twice is a no-op: unchanged users are simply
 * re-written with the same values, and already-deleted users stay deleted.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  /** Process-local guard against overlapping runs for the same customer. */
  private readonly runningCustomers = new Set<string>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly customerApiClient: CustomerApiClient,
    private readonly customersService: CustomersService,
    private readonly config: ConfigService,
  ) {}

  async syncCustomer(customerId?: string): Promise<SyncRun> {
    const customer = customerId
      ? await this.customersService.findById(customerId)
      : await this.customersService.getOrCreateDefaultCustomer();

    if (!customer) {
      throw new Error(`Unknown customer: ${customerId}`);
    }

    if (this.runningCustomers.has(customer.id)) {
      throw new SyncInProgressError(customer.id);
    }
    this.runningCustomers.add(customer.id);

    const client = this.supabase.getClient();

    const { data: createdRun, error: createRunError } = await client
      .from('sync_runs')
      .insert({ customer_id: customer.id, status: 'RUNNING' })
      .select('*')
      .single<SyncRunRow>();
    if (createRunError || !createdRun) {
      this.runningCustomers.delete(customer.id);
      throw new Error(`Failed to create sync run: ${createRunError?.message}`);
    }
    const syncRunId = createdRun.id;

    try {
      const token = this.config.get<string>('app.customer.apiToken')!;
      const externalUsers = await this.customerApiClient.fetchAllUsers({
        baseUrl: customer.apiBaseUrl,
        token,
        timeoutMs: this.config.get<number>('app.customer.timeoutMs')!,
        maxRetries: this.config.get<number>('app.customer.maxRetries')!,
        pageSize: this.config.get<number>('app.customer.pageSize')!,
      });

      const payload = externalUsers.map((externalUser) => {
        const data = mapExternalUserToSyncedUserData(externalUser);
        return {
          externalUserId: data.externalUserId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          status: data.status,
          companyName: data.companyName,
          companyIndustry: data.companyIndustry,
          companyRole: data.companyRole,
          companyWebsite: data.companyWebsite,
          companyEmployees: data.companyEmployees,
          externalCreatedAt: data.externalCreatedAt.toISOString(),
          externalUpdatedAt: data.externalUpdatedAt.toISOString(),
        };
      });

      const { data: rpcResult, error: rpcError } = await client
        .rpc('sync_users', {
          p_customer_id: customer.id,
          p_users: payload,
        })
        .single<{ created: number; updated: number; deleted: number }>();

      if (rpcError || !rpcResult) {
        throw new Error(`sync_users failed: ${rpcError?.message}`);
      }

      const result = {
        fetched: externalUsers.length,
        created: rpcResult.created,
        updated: rpcResult.updated,
        deleted: rpcResult.deleted,
      };

      const { data: completedRow, error: completeError } = await client
        .from('sync_runs')
        .update({
          status: 'SUCCESS',
          completed_at: new Date().toISOString(),
          records_fetched: result.fetched,
          records_created: result.created,
          records_updated: result.updated,
          records_deleted: result.deleted,
        })
        .eq('id', syncRunId)
        .select('*')
        .single<SyncRunRow>();
      if (completeError || !completedRow) {
        throw new Error(
          `Failed to record sync run completion: ${completeError?.message}`,
        );
      }

      this.logger.log(
        `sync.completed customerId=${customer.id} fetched=${result.fetched} created=${result.created} updated=${result.updated} deleted=${result.deleted}`,
      );
      return mapSyncRunRow(completedRow);
    } catch (error) {
      const { code, message } = this.classifyError(error);
      this.logger.error(
        `sync.failed customerId=${customer.id} code=${code} message=${message}`,
      );

      const { data: failedRow, error: failError } = await client
        .from('sync_runs')
        .update({
          status: 'FAILED',
          completed_at: new Date().toISOString(),
          error_code: code,
          error_message: message,
        })
        .eq('id', syncRunId)
        .select('*')
        .single<SyncRunRow>();
      if (failError || !failedRow) {
        throw new Error(
          `Failed to record sync run failure: ${failError?.message}`,
        );
      }
      return mapSyncRunRow(failedRow);
    } finally {
      this.runningCustomers.delete(customer.id);
    }
  }

  async listRuns(
    page: number,
    limit: number,
  ): Promise<{ data: SyncRun[]; total: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await this.supabase
      .getClient()
      .from('sync_runs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to list sync runs: ${error.message}`);
    }

    return {
      data: ((data ?? []) as SyncRunRow[]).map(mapSyncRunRow),
      total: count ?? 0,
    };
  }

  private classifyError(error: unknown): { code: string; message: string } {
    if (error instanceof CustomerApiError) {
      return {
        code:
          error.name === 'CustomerApiUnauthorizedError'
            ? 'EXTERNAL_API_UNAUTHORIZED'
            : 'EXTERNAL_API',
        message: error.message,
      };
    }
    if (error instanceof Error) {
      return { code: 'UNEXPECTED', message: error.message };
    }
    return {
      code: 'UNEXPECTED',
      message: 'Unknown error during synchronization.',
    };
  }
}
