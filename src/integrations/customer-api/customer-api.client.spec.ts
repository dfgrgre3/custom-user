import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders } from 'axios';
import { of, throwError } from 'rxjs';
import { CustomerApiClient } from './customer-api.client';
import {
  CustomerApiContractError,
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

  it('rejects a response with an invalid user status instead of passing it through', async () => {
    const get = jest.fn().mockReturnValue(
      of(
        pageResponse({
          data: [
            {
              id: '1',
              name: 'A',
              email: 'a@example.com',
              // Not one of active/invited/suspended — the mapper's
              // `as ExternalUserStatus` cast would have accepted this
              // silently before runtime validation was added.
              status: 'deleted' as never,
              company: { name: 'Co', industry: 'Tech', role: 'Eng' },
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(client.fetchAllUsers(options)).rejects.toBeInstanceOf(
      CustomerApiContractError,
    );
  });

  it('rejects a response missing required fields', async () => {
    const get = jest
      .fn()
      .mockReturnValue(of({ data: { data: 'not-an-array' } }));
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(client.fetchAllUsers(options)).rejects.toBeInstanceOf(
      CustomerApiContractError,
    );
  });

  it('does not retry a contract violation (retrying an identical malformed response cannot succeed)', async () => {
    const get = jest
      .fn()
      .mockReturnValue(of({ data: { data: 'not-an-array' } }));
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(
      client.fetchAllUsers({ ...options, maxRetries: 3 }),
    ).rejects.toBeInstanceOf(CustomerApiContractError);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed email instead of passing it through', async () => {
    const get = jest.fn().mockReturnValue(
      of(
        pageResponse({
          data: [
            {
              id: '1',
              name: 'A',
              email: 'not-an-email',
              status: 'active',
              company: { name: 'Co', industry: 'Tech', role: 'Eng' },
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(client.fetchAllUsers(options)).rejects.toBeInstanceOf(
      CustomerApiContractError,
    );
  });

  it('rejects an unparseable createdAt/updatedAt instead of producing Invalid Date', async () => {
    const get = jest.fn().mockReturnValue(
      of(
        pageResponse({
          data: [
            {
              id: '1',
              name: 'A',
              email: 'a@example.com',
              status: 'active',
              company: { name: 'Co', industry: 'Tech', role: 'Eng' },
              createdAt: 'not-a-date',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(client.fetchAllUsers(options)).rejects.toBeInstanceOf(
      CustomerApiContractError,
    );
  });

  it('rejects a response with duplicate user ids on the same page', async () => {
    const duplicateUser = {
      id: '1',
      name: 'A',
      email: 'a@example.com',
      status: 'active' as const,
      company: { name: 'Co', industry: 'Tech', role: 'Eng' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const get = jest
      .fn()
      .mockReturnValue(
        of(pageResponse({ data: [duplicateUser, duplicateUser] })),
      );
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(client.fetchAllUsers(options)).rejects.toBeInstanceOf(
      CustomerApiContractError,
    );
  });

  it('rejects the same user id reappearing across different pages', async () => {
    const user = (id: string) => ({
      id,
      name: 'A',
      email: 'a@example.com',
      status: 'active' as const,
      company: { name: 'Co', industry: 'Tech', role: 'Eng' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const get = jest
      .fn()
      .mockReturnValueOnce(
        of(
          pageResponse({
            data: [user('1')],
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
        // Same id ('1') reappears on page 2 — should never happen, but if
        // the underlying dataset shifts mid-pagination it could.
        of(
          pageResponse({
            data: [user('1')],
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

    await expect(
      client.fetchAllUsers({ ...options, pageSize: 1 }),
    ).rejects.toBeInstanceOf(CustomerApiContractError);
  });

  it('retries a 429 (rate limited) rather than failing immediately', async () => {
    const get = jest
      .fn()
      .mockReturnValueOnce(throwError(() => makeAxiosError(429)))
      .mockReturnValueOnce(of(pageResponse()));
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    const users = await client.fetchAllUsers({ ...options, maxRetries: 1 });

    expect(users).toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('retries a 408 (request timeout) rather than failing immediately', async () => {
    const get = jest
      .fn()
      .mockReturnValueOnce(throwError(() => makeAxiosError(408)))
      .mockReturnValueOnce(of(pageResponse()));
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    const users = await client.fetchAllUsers({ ...options, maxRetries: 1 });

    expect(users).toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('still does not retry a plain 400 (not in the retryable set)', async () => {
    const get = jest
      .fn()
      .mockReturnValue(throwError(() => makeAxiosError(400)));
    const client = new CustomerApiClient({ get } as unknown as HttpService);

    await expect(
      client.fetchAllUsers({ ...options, maxRetries: 3 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('honors a numeric Retry-After header instead of the default backoff', async () => {
    jest.useFakeTimers();
    try {
      const headers = new AxiosHeaders();
      headers.set('retry-after', '5');
      const rateLimited = new AxiosError(
        'Too Many Requests',
        '429',
        undefined,
        undefined,
        {
          status: 429,
          data: {},
          statusText: '',
          headers,
          config: { headers: new AxiosHeaders() },
        },
      );
      const get = jest
        .fn()
        .mockReturnValueOnce(throwError(() => rateLimited))
        .mockReturnValueOnce(of(pageResponse()));
      const client = new CustomerApiClient({ get } as unknown as HttpService);

      const resultPromise = client.fetchAllUsers({ ...options, maxRetries: 1 });

      // Flush the first (failing) request's microtask queue before advancing
      // timers, so the retry's setTimeout has actually been scheduled.
      await Promise.resolve();
      await Promise.resolve();

      // Advancing by exactly the Retry-After duration should be enough to
      // trigger the retry; the default exponential backoff for attempt 1
      // (250ms) would already have fired well before this point if the
      // header were being ignored, so this also implicitly confirms the
      // header value — not the default — is what's being waited on.
      jest.advanceTimersByTime(5000);
      const users = await resultPromise;

      expect(users).toEqual([]);
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
