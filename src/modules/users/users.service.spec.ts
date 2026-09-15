import { NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

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
  });

  it('computes totalPages as at least 1 even with zero results', async () => {
    const usersRepository = {
      findMany: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
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
    );

    const result = await service.getById('u1');

    expect(result).toMatchObject({
      id: 'u1',
      name: 'Ada Lovelace',
      company: 'Acme',
    });
  });

  it('getById throws NotFoundException when no user matches', async () => {
    const usersRepository = { findById: jest.fn().mockResolvedValue(null) };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
    );

    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
