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

/** Minimal stand-in for the Supabase query builder chain used by SyncService. */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = ['insert', 'update', 'select', 'eq', 'order', 'range'] as const;
  for (const method of chain) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  return builder;
}

describe('SyncService', () => {
  let fromMock: jest.Mock;
  let rpcMock: jest.Mock;
  let supabase: { getClient: jest.Mock };
  let customerApiClient: { fetchAllUsers: jest.Mock };
  let customersService: {
    findById: jest.Mock;
    getOrCreateDefaultCustomer: jest.Mock;
  };
  let config: { get: jest.Mock };
  let service: SyncService;

  let syncRunRow: Record<string, unknown>;

  beforeEach(() => {
    syncRunRow = {
      id: 'run-1',
      customer_id: CUSTOMER.id,
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

    fromMock = jest.fn().mockImplementation((table: string) => {
      if (table === 'sync_runs') {
        const builder = makeQueryBuilder({ data: syncRunRow, error: null });
        // Every insert/update resolves with the latest syncRunRow snapshot,
        // mutated by whichever `update({...})` call was made.
        builder.update = jest
          .fn()
          .mockImplementation((patch: Record<string, unknown>) => {
            Object.assign(syncRunRow, patch);
            return builder;
          });
        builder.single = jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ data: syncRunRow, error: null }),
          );
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    rpcMock = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: { created: 0, updated: 0, deleted: 0 },
        error: null,
      }),
    });

    supabase = {
      getClient: jest.fn().mockReturnValue({ from: fromMock, rpc: rpcMock }),
    };
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
      supabase as unknown as SupabaseService,
      customerApiClient as unknown as CustomerApiClient,
      customersService as unknown as CustomersService,
      config as unknown as ConfigService,
    );
  });

  function mockRpcResult(created: number, updated: number, deleted: number) {
    rpcMock.mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: { created, updated, deleted },
        error: null,
      }),
    });
  }

  it('creates new users that were never seen before', async () => {
    mockRpcResult(2, 0, 0);
    customerApiClient.fetchAllUsers.mockResolvedValue([
      externalUser('u1'),
      externalUser('u2'),
    ]);

    const run = await service.syncCustomer();

    expect(run.status).toBe('SUCCESS');
    expect(run.recordsCreated).toBe(2);
    expect(run.recordsUpdated).toBe(0);
    expect(run.recordsDeleted).toBe(0);
    expect(rpcMock).toHaveBeenCalledWith(
      'sync_users',
      expect.objectContaining({ p_customer_id: CUSTOMER.id }),
    );
  });

  it('marks previously-known users as updated, not created', async () => {
    mockRpcResult(0, 1, 0);
    customerApiClient.fetchAllUsers.mockResolvedValue([externalUser('u1')]);

    const run = await service.syncCustomer();

    expect(run.recordsCreated).toBe(0);
    expect(run.recordsUpdated).toBe(1);
  });

  it('soft-deletes users that are no longer present in the fetched dataset', async () => {
    mockRpcResult(0, 1, 1);
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
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects a second concurrent sync for the same customer', async () => {
    let resolveFetch!: (users: ExternalUser[]) => void;
    customerApiClient.fetchAllUsers.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    mockRpcResult(0, 0, 0);

    const firstRun = service.syncCustomer();
    await expect(service.syncCustomer()).rejects.toBeInstanceOf(
      SyncInProgressError,
    );

    resolveFetch([]);
    await firstRun;
  });
});
