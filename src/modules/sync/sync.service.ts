import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncInProgressError } from '../../common/errors/errors';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { CustomerApiClient } from '../../integrations/customer-api/customer-api.client';
import { CustomerApiError } from '../../integrations/customer-api/customer-api.errors';
import { mapExternalUserToSyncedUserData } from '../../integrations/customer-api/customer-api.mapper';
import { CustomersService } from '../customers/customers.service';
import { SyncRun, SyncRunRow, mapSyncRunRow } from '../../domain/types';

/** Postgres error code raised by `start_sync_run()` when a lock is already held (see migration 002). */
const SYNC_ALREADY_RUNNING_CODE = 'P0001';

/**
 * Orchestrates one synchronization run for one customer:
 *
 *   1. Start the run via the `start_sync_run` Postgres function, which
 *      atomically enforces "at most one RUNNING sync per customer" through
 *      the sync_run_locks table (see supabase/migrations/002) — a
 *      database-level lock, not an in-process one, so it holds even across
 *      multiple backend instances. A leased expiry means a crashed
 *      process's stuck RUNNING row doesn't lock the customer out forever.
 *   2. Fetch the *complete* external dataset (all pages) before touching
 *      user data — a failure here leaves previously synced data intact.
 *   3. Map every external user into our internal representation.
 *   4. Complete the run via `complete_sync_run`, which performs the
 *      upsert + soft-delete pass AND marks the sync_run SUCCESS in one
 *      Postgres transaction (see supabase/migrations/003). Folding both
 *      into one function closes a real consistency gap: previously, the
 *      user upsert and the "mark SUCCESS" write were two separate
 *      round-trips, so a failure on the second one recorded a SyncRun as
 *      FAILED even though the user data had already been committed —
 *      users would be correctly synchronized while their own operational
 *      record said otherwise. Now both succeed or both roll back together.
 *
 * Running the same fetch twice is a no-op: unchanged users are simply
 * re-written with the same values, and already-deleted users stay deleted.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

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

    const client = this.supabase.getClient();

    const { data: createdRun, error: createRunError } = await client
      .rpc('start_sync_run', { p_customer_id: customer.id })
      .single<SyncRunRow>();
    if (createRunError) {
      if (createRunError.code === SYNC_ALREADY_RUNNING_CODE) {
        throw new SyncInProgressError(customer.id);
      }
      throw new Error(`Failed to create sync run: ${createRunError.message}`);
    }
    if (!createdRun) {
      throw new Error('Failed to create sync run: no row returned.');
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

      const { data: completedRow, error: completeError } = await client
        .rpc('complete_sync_run', {
          p_sync_run_id: syncRunId,
          p_customer_id: customer.id,
          p_users: payload,
        })
        .single<SyncRunRow>();
      if (completeError || !completedRow) {
        throw new Error(
          `Failed to complete sync run: ${completeError?.message}`,
        );
      }

      this.logger.log(
        `sync.completed customerId=${customer.id} fetched=${completedRow.records_fetched} created=${completedRow.records_created} updated=${completedRow.records_updated} deleted=${completedRow.records_deleted}`,
      );
      return mapSyncRunRow(completedRow);
    } catch (error) {
      const { code, message } = this.classifyError(error);
      this.logger.error(
        `sync.failed customerId=${customer.id} code=${code} message=${message}`,
      );

      const { data: failedRow, error: failError } = await client
        .rpc('fail_sync_run', {
          p_sync_run_id: syncRunId,
          p_error_code: code,
          p_error_message: message,
        })
        .single<SyncRunRow>();
      if (failError || !failedRow) {
        throw new Error(
          `Failed to record sync run failure: ${failError?.message}`,
        );
      }
      return mapSyncRunRow(failedRow);
    }
  }

  /**
   * `customerId` is required, same reasoning as UsersRepository.findMany:
   * without it, a deployment with more than one `Customer` row would leak
   * every customer's sync history into one response.
   */
  async listRuns(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: SyncRun[]; total: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await this.supabase
      .getClient()
      .from('sync_runs')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
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

  /** Resolves an explicit customerId, or the configured default customer. */
  async resolveCustomerId(customerId?: string): Promise<string> {
    if (customerId) return customerId;
    const customer = await this.customersService.getOrCreateDefaultCustomer();
    return customer.id;
  }

  private classifyError(error: unknown): { code: string; message: string } {
    if (error instanceof CustomerApiError) {
      let code = 'EXTERNAL_API';
      if (error.name === 'CustomerApiUnauthorizedError') {
        code = 'EXTERNAL_API_UNAUTHORIZED';
      } else if (error.name === 'CustomerApiContractError') {
        // Distinct from a transport/HTTP failure: the API answered, but its
        // shape didn't match what we validate against (see
        // customer-api.schema.ts). Surfacing this separately makes it clear
        // in SyncRun history that this isn't "API was down."
        code = 'EXTERNAL_API_CONTRACT_VIOLATION';
      }
      return { code, message: error.message };
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
