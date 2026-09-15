import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  function makeService(options: {
    dbError?: { message: string } | null;
    dbThrows?: boolean;
    apiFails?: boolean;
  }) {
    const from = jest.fn().mockReturnValue({
      select: jest.fn().mockImplementation(() => {
        if (options.dbThrows) {
          throw new Error('boom');
        }
        return Promise.resolve({ error: options.dbError ?? null });
      }),
    });
    const supabase = {
      getClient: jest.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService;

    const get = jest
      .fn()
      .mockReturnValue(
        options.apiFails
          ? throwError(() => new Error('network error'))
          : of({ data: {} }),
      );
    const http = { get } as unknown as HttpService;

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'app.customer.apiBaseUrl': 'https://example.test',
          'app.customer.apiToken': 'token',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    return new HealthService(supabase, http, config);
  }

  it('reports ok when both the database and customer API are reachable', async () => {
    const service = makeService({});
    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.components.database.status).toBe('ok');
    expect(result.components.customerApi.status).toBe('ok');
  });

  it('reports error for the database when the query fails', async () => {
    const service = makeService({ dbError: { message: 'connection refused' } });
    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.components.database).toEqual({
      status: 'error',
      error: 'connection refused',
    });
    expect(result.components.customerApi.status).toBe('ok');
  });

  it('reports error for the database when the client throws', async () => {
    const service = makeService({ dbThrows: true });
    const result = await service.check();

    expect(result.components.database.status).toBe('error');
  });

  it('reports error for the customer API when it is unreachable', async () => {
    const service = makeService({ apiFails: true });
    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.components.customerApi.status).toBe('error');
    expect(result.components.database.status).toBe('ok');
  });
});
