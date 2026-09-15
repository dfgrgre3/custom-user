import { ConfigService } from '@nestjs/config';
import { SyncInProgressError } from '../../common/errors/errors';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { CustomerApiClient } from '../../integrations/customer-api/customer-api.client';
import { CustomerApiUnauthorizedError } from '../../integrations/customer-api/customer-api.errors';
import { ExternalUser } from '../../integrations/customer-api/customer-api.types';
import { CustomersService } from '../customers/customers.service';
import { SyncService } from './sync.service';

const CUSTOMER = {
  id: 'customer-1',
  apiBaseUrl: 'https://example.test',
  name: 'Test',
};

function externalUser(
  id: string,
  overrides: Partial<ExternalUser> = {},
): ExternalUser {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    status: 'active',
    company: { name: 'Acme', industry: 'Tech', role: 'Engineer' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Everything the RPC-based SyncService touches now goes through
 * `client.rpc(name, params)`. This stand-in tracks a single mutable
 * sync_runs row (mirroring what start_sync_run/complete_sync_run/
 * fail_sync_run would do server-side) and dispatches by RPC name.
 */
function makeSupabaseStub() {
  let syncRunRow: Record<string, unknown> | null = null;
  let running = false;

  const rpc = jest.fn((name: string, params: Record<string, unknown>) => {
    if (name === 'start_sync_run') {
      if (running) {
        return {
          single: () =>
            Promise.resolve({
              data: null,
              error: { code: 'P0001', message: 'sync_already_running' },
            }),
        };
      }
      running = true;
      syncRunRow = {
        id: 'run-1',
        customer_id: params.p_customer_id,
        status: 'RUNNING',
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: null,
        records_fetched: null,
        records_created: null,
        records_updated: null,
        records_deleted: null,
        error_code: null,
        error_message: null,
      };
      return {
        single: () => Promise.resolve({ data: syncRunRow, error: null }),
      };
    }

    if (name === 'complete_sync_run') {
      return {
        single: () =>
          Promise.resolve(rpc.completeResult ?? { data: null, error: null }),
      };
    }

    if (name === 'fail_sync_run') {
      running = false;
      Object.assign(syncRunRow!, {
        status: 'FAILED',
        completed_at: '2026-01-01T00:01:00.000Z',
        error_code: params.p_error_code,
        error_message: params.p_error_message,
      });
      return {
        single: () => Promise.resolve({ data: syncRunRow, error: null }),
      };
    }

    throw new Error(`Unexpected rpc: ${name}`);
  }) as jest.Mock & { completeResult?: { data: unknown; error: unknown } };

  function mockComplete(created: number, updated: number, deleted: number) {
    rpc.completeResult = {
      data: {
        ...syncRunRow,
        status: 'SUCCESS',
        completed_at: '2026-01-01T00:01:00.000Z',
        records_fetched: created + updated,
        records_created: created,
        records_updated: updated,
        records_deleted: deleted,
      },
      error: null,
    };
    running = false;
  }

  return {
    supabase: { getClient: jest.fn().mockReturnValue({ rpc }) },
    rpc,
    mockComplete,
  };
}

describe('SyncService', () => {
  let stub: ReturnType<typeof makeSupabaseStub>;
  let customerApiClient: { fetchAllUsers: jest.Mock };
  let customersService: {
    findById: jest.Mock;
    getOrCreateDefaultCustomer: jest.Mock;
  };
  let config: { get: jest.Mock };
  let service: SyncService;

  beforeEach(() => {
    stub = makeSupabaseStub();
    customerApiClient = { fetchAllUsers: jest.fn() };
    customersService = {
      findById: jest.fn().mockResolvedValue(CUSTOMER),
      getOrCreateDefaultCustomer: jest.fn().mockResolvedValue(CUSTOMER),
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'app.customer.apiToken': 'token',
          'app.customer.timeoutMs': 1000,
          'app.customer.maxRetries': 3,
          'app.customer.pageSize': 100,
        };
        return values[key];
      }),
    };

    service = new SyncService(
      stub.supabase as unknown as SupabaseService,
      customerApiClient as unknown as CustomerApiClient,
      customersService as unknown as CustomersService,
      config as unknown as ConfigService,
    );
  });

  it('creates new users that were never seen before', async () => {
    stub.mockComplete(2, 0, 0);
    customerApiClient.fetchAllUsers.mockResolvedValue([
      externalUser('u1'),
      externalUser('u2'),
    ]);

    const run = await service.syncCustomer();

    expect(run.status).toBe('SUCCESS');
    expect(run.recordsCreated).toBe(2);
    expect(run.recordsUpdated).toBe(0);
    expect(run.recordsDeleted).toBe(0);
    expect(stub.rpc).toHaveBeenCalledWith(
      'complete_sync_run',
      expect.objectContaining({ p_customer_id: CUSTOMER.id }),
    );
  });

  it('marks previously-known users as updated, not created', async () => {
    stub.mockComplete(0, 1, 0);
    customerApiClient.fetchAllUsers.mockResolvedValue([externalUser('u1')]);

    const run = await service.syncCustomer();

    expect(run.recordsCreated).toBe(0);
    expect(run.recordsUpdated).toBe(1);
  });

  it('soft-deletes users that are no longer present in the fetched dataset', async () => {
    stub.mockComplete(0, 1, 1);
    customerApiClient.fetchAllUsers.mockResolvedValue([externalUser('u1')]);

    const run = await service.syncCustomer();

    expect(run.recordsDeleted).toBe(1);
  });

  it('records a FAILED run and leaves prior data untouched when the customer API is unreachable', async () => {
    customerApiClient.fetchAllUsers.mockRejectedValue(
      new CustomerApiUnauthorizedError(),
    );

    const run = await service.syncCustomer();

    expect(run.status).toBe('FAILED');
    expect(run.errorCode).toBe('EXTERNAL_API_UNAUTHORIZED');
    expect(stub.rpc).not.toHaveBeenCalledWith(
      'complete_sync_run',
      expect.anything(),
    );
  });

  it('rejects a second concurrent sync for the same customer via the database-level lock', async () => {
    let resolveFetch!: (users: ExternalUser[]) => void;
    customerApiClient.fetchAllUsers.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    stub.mockComplete(0, 0, 0);

    const firstRun = service.syncCustomer();
    await expect(service.syncCustomer()).rejects.toBeInstanceOf(
      SyncInProgressError,
    );

    resolveFetch([]);
    await firstRun;
  });
});
