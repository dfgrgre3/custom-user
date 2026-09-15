import { ConfigService } from '@nestjs/config';
import { SyncRunStatus } from '@prisma/client';
import { SyncInProgressError } from '../../common/errors/errors';
import { PrismaService } from '../../infrastructure/database/prisma.service';
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

describe('SyncService', () => {
  let prisma: {
    syncRun: { create: jest.Mock; update: jest.Mock };
    user: { findMany: jest.Mock; upsert: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let customerApiClient: { fetchAllUsers: jest.Mock };
  let customersService: {
    findById: jest.Mock;
    getOrCreateDefaultCustomer: jest.Mock;
  };
  let config: { get: jest.Mock };
  let service: SyncService;

  beforeEach(() => {
    prisma = {
      syncRun: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'run-1', status: SyncRunStatus.RUNNING }),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'run-1', ...data }),
          ),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma)),
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
      prisma as unknown as PrismaService,
      customerApiClient as unknown as CustomerApiClient,
      customersService as unknown as CustomersService,
      config as unknown as ConfigService,
    );
  });

  it('creates new users that were never seen before', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([]) // existing ids for upsert accounting
      .mockResolvedValueOnce([]); // still-active users for deletion pass
    customerApiClient.fetchAllUsers.mockResolvedValue([
      externalUser('u1'),
      externalUser('u2'),
    ]);

    const run = await service.syncCustomer();

    expect(run.status).toBe(SyncRunStatus.SUCCESS);
    expect(run.recordsCreated).toBe(2);
    expect(run.recordsUpdated).toBe(0);
    expect(run.recordsDeleted).toBe(0);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(2);
  });

  it('marks previously-known users as updated, not created', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ externalUserId: 'u1' }])
      .mockResolvedValueOnce([{ id: 'row-1', externalUserId: 'u1' }]);
    customerApiClient.fetchAllUsers.mockResolvedValue([externalUser('u1')]);

    const run = await service.syncCustomer();

    expect(run.recordsCreated).toBe(0);
    expect(run.recordsUpdated).toBe(1);
  });

  it('soft-deletes users that are no longer present in the fetched dataset', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([
        { externalUserId: 'u1' },
        { externalUserId: 'u2' },
      ])
      .mockResolvedValueOnce([
        { id: 'row-1', externalUserId: 'u1' },
        { id: 'row-2', externalUserId: 'u2' },
      ]);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    // Only u1 comes back from the customer API; u2 has disappeared.
    customerApiClient.fetchAllUsers.mockResolvedValue([externalUser('u1')]);

    const run = await service.syncCustomer();

    expect(run.recordsDeleted).toBe(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['row-2'] } },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('clears deletedAt (reactivates) when an upsert runs for a previously-deleted user', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ externalUserId: 'u1' }])
      .mockResolvedValueOnce([]);
    customerApiClient.fetchAllUsers.mockResolvedValue([externalUser('u1')]);

    await service.syncCustomer();

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('records a FAILED run and leaves prior data untouched when the customer API is unreachable', async () => {
    customerApiClient.fetchAllUsers.mockRejectedValue(
      new CustomerApiUnauthorizedError(),
    );

    const run = await service.syncCustomer();

    expect(run.status).toBe(SyncRunStatus.FAILED);
    expect(run.errorCode).toBe('EXTERNAL_API_UNAUTHORIZED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('rejects a second concurrent sync for the same customer', async () => {
    let resolveFetch!: (users: ExternalUser[]) => void;
    customerApiClient.fetchAllUsers.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    prisma.user.findMany.mockResolvedValue([]);

    const firstRun = service.syncCustomer();
    await expect(service.syncCustomer()).rejects.toBeInstanceOf(
      SyncInProgressError,
    );

    resolveFetch([]);
    await firstRun;
  });
});
