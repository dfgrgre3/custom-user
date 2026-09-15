import { NotFoundException } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const DEFAULT_CUSTOMER = { id: 'default-customer-id' };

const sampleEntity = {
  id: 'u1',
  customerId: 'c1',
  externalUserId: 'e1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: null,
  status: 'active',
  companyName: 'Acme',
  companyIndustry: 'Tech',
  companyRole: 'Engineer',
  companyWebsite: null,
  companyEmployees: null,
  externalCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
  externalUpdatedAt: new Date('2026-01-02T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  deletedAt: null,
};

function makeCustomersService() {
  return {
    getOrCreateDefaultCustomer: jest.fn().mockResolvedValue(DEFAULT_CUSTOMER),
  } as unknown as CustomersService;
}

describe('UsersService', () => {
  it('wraps repository results into a paginated public response', async () => {
    const usersRepository = {
      findMany: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'u1',
            customerId: 'c1',
            externalUserId: 'e1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            phone: null,
            status: 'active',
            companyName: 'Acme',
            companyIndustry: 'Tech',
            companyRole: 'Engineer',
            companyWebsite: null,
            companyEmployees: null,
            externalCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
            externalUpdatedAt: new Date('2026-01-02T00:00:00.000Z'),
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            deletedAt: null,
          },
        ],
        total: 1,
      }),
    };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
      makeCustomersService(),
    );

    const result = await service.list({ page: 1, limit: 20 });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(result.data[0]).toMatchObject({
      id: 'u1',
      name: 'Ada Lovelace',
      company: 'Acme',
      isDeleted: false,
    });
    expect(usersRepository.findMany).toHaveBeenCalledWith(
      DEFAULT_CUSTOMER.id,
      expect.anything(),
    );
  });

  it('scopes to an explicit customerId instead of the default customer when given', async () => {
    const usersRepository = {
      findMany: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const customersService = makeCustomersService();
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
      customersService,
    );

    await service.list({ page: 1, limit: 20 }, 'other-customer-id');

    expect(usersRepository.findMany).toHaveBeenCalledWith(
      'other-customer-id',
      expect.anything(),
    );
    expect(customersService.getOrCreateDefaultCustomer).not.toHaveBeenCalled();
  });

  it('computes totalPages as at least 1 even with zero results', async () => {
    const usersRepository = {
      findMany: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
      makeCustomersService(),
    );

    const result = await service.list({ page: 1, limit: 20 });

    expect(result.pagination.totalPages).toBe(1);
  });

  it('getById returns the mapped public shape for an existing user', async () => {
    const usersRepository = {
      findById: jest.fn().mockResolvedValue(sampleEntity),
    };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
      makeCustomersService(),
    );

    const result = await service.getById('u1');

    expect(result).toMatchObject({
      id: 'u1',
      name: 'Ada Lovelace',
      company: 'Acme',
    });
    expect(usersRepository.findById).toHaveBeenCalledWith(
      DEFAULT_CUSTOMER.id,
      'u1',
    );
  });

  it('getById throws NotFoundException when no user matches', async () => {
    const usersRepository = { findById: jest.fn().mockResolvedValue(null) };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
      makeCustomersService(),
    );

    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("getById scoped to a different customer never returns another customer's user with the same id", async () => {
    // The repository itself enforces this via `.eq('customer_id', ...)`;
    // this test documents that the service always passes a customer scope
    // through rather than ever calling findById with only an id.
    const usersRepository = { findById: jest.fn().mockResolvedValue(null) };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
      makeCustomersService(),
    );

    await expect(service.getById('u1', 'customer-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(usersRepository.findById).toHaveBeenCalledWith('customer-a', 'u1');
  });
});
