import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders } from 'axios';
import { of, throwError } from 'rxjs';
import { CustomerApiClient } from './customer-api.client';
import {
  CustomerApiUnauthorizedError,
  CustomerApiUnavailableError,
} from './customer-api.errors';
import { ExternalUserListResponse } from './customer-api.types';

function makeAxiosError(status: number, data: unknown = {}): AxiosError {
  return new AxiosError(
    'Request failed',
    String(status),
    undefined,
    undefined,
    {
      status,
      data,
      statusText: '',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    },
  );
}

function pageResponse(overrides: Partial<ExternalUserListResponse> = {}): {
  data: ExternalUserListResponse;
} {
  return {
    data: {
      data: [],
      pagination: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
      ...overrides,
    },
  };
}

const options = {
  baseUrl: 'https://example.test',
  token: 'test-token',
  timeoutMs: 1000,
  maxRetries: 3,
  pageSize: 100,
};

describe('CustomerApiClient', () => {
  it('does not retry on a 401 and reports it as unauthorized', async () => {
    const get = jest
      .fn()
      .mockReturnValue(throwError(() => makeAxiosError(401)));
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(client.fetchAllUsers(options)).rejects.toBeInstanceOf(
      CustomerApiUnauthorizedError,
    );
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('retries a 500 up to maxRetries then fails as unavailable', async () => {
    const get = jest
      .fn()
      .mockReturnValue(throwError(() => makeAxiosError(500)));
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(
      client.fetchAllUsers({ ...options, maxRetries: 2 }),
    ).rejects.toBeInstanceOf(CustomerApiUnavailableError);
    expect(get).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('fetches every page and flattens the results', async () => {
    const get = jest
      .fn()
      .mockReturnValueOnce(
        of(
          pageResponse({
            data: [
              {
                id: '1',
                name: 'A',
                email: 'a@example.com',
                status: 'active',
                company: { name: 'Co', industry: 'Tech', role: 'Eng' },
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            pagination: {
              page: 1,
              limit: 1,
              total: 2,
              totalPages: 2,
              hasNextPage: true,
              hasPrevPage: false,
            },
          }),
        ),
      )
      .mockReturnValueOnce(
        of(
          pageResponse({
            data: [
              {
                id: '2',
                name: 'B',
                email: 'b@example.com',
                status: 'active',
                company: { name: 'Co', industry: 'Tech', role: 'Eng' },
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            pagination: {
              page: 2,
              limit: 1,
              total: 2,
              totalPages: 2,
              hasNextPage: false,
              hasPrevPage: true,
            },
          }),
        ),
      );
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    const users = await client.fetchAllUsers({ ...options, pageSize: 1 });

    expect(users.map((u) => u.id)).toEqual(['1', '2']);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
