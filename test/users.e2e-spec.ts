import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/infrastructure/database/supabase.service';
import { CustomerApiClient } from '../src/integrations/customer-api/customer-api.client';
import { ExternalUser } from '../src/integrations/customer-api/customer-api.types';

/**
 * End-to-end coverage for the two required endpoints, run against a real
 * database (see DATABASE_URL) with the customer API client replaced by a
 * fake so the test is deterministic and never depends on network access.
 */
describe('Users & Sync (e2e)', () => {
  let app: INestApplication;
  let supabase: SupabaseService;
  const fetchAllUsers = jest.fn<Promise<ExternalUser[]>, []>();

  const externalUsers: ExternalUser[] = [
    {
      id: 'ext-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      status: 'active',
      company: {
        name: 'Analytical Engines',
        industry: 'Computing',
        role: 'Mathematician',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'ext-2',
      name: 'Alan Turing',
      email: 'alan@example.com',
      status: 'active',
      company: {
        name: 'Bletchley Park',
        industry: 'Defense',
        role: 'Cryptanalyst',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CustomerApiClient)
      .useValue({ fetchAllUsers })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['sync/users'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    supabase = app.get(SupabaseService);
    const config = app.get(ConfigService);
    const client = supabase.getClient();
    // Ensure a clean customer row scoped to this test run.
    await client.from('users').delete().not('id', 'is', null);
    await client.from('sync_runs').delete().not('id', 'is', null);
    await client
      .from('customers')
      .delete()
      .eq('name', config.get('app.customer.name'));
  });

  afterAll(async () => {
    // If beforeAll failed before `app`/`supabase` were assigned (e.g. missing
    // Supabase env vars), there's nothing to clean up or close.
    if (!app || !supabase) return;

    const client = supabase.getClient();
    await client.from('users').delete().not('id', 'is', null);
    await client.from('sync_runs').delete().not('id', 'is', null);
    await app.close();
  });

  it('POST /sync/users fetches, transforms, and persists external users', async () => {
    fetchAllUsers.mockResolvedValueOnce(externalUsers);

    const response = await request(app.getHttpServer())
      .post('/sync/users')
      .expect(200);

    expect(response.body.status).toBe('SUCCESS');
    expect(response.body.recordsCreated).toBe(2);
    expect(response.body.recordsUpdated).toBe(0);
  });

  it('GET /api/v1/users reads from our database, not the customer API', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .expect(200);

    expect(response.body.pagination.total).toBe(2);
    const names = response.body.data
      .map((u: { name: string }) => u.name)
      .sort();
    expect(names).toEqual(['Ada Lovelace', 'Alan Turing']);
    expect(fetchAllUsers).toHaveBeenCalledTimes(1); // not called again for a read
  });

  it('GET /api/v1/users?company= filters case-insensitively', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users?company=bletchley')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe('Alan Turing');
  });

  it('GET /api/v1/users?search= searches profile and company fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users?search=Mathematician')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe('Ada Lovelace');
  });

  it('running sync again does not create duplicates (idempotency)', async () => {
    fetchAllUsers.mockResolvedValueOnce(externalUsers);

    const response = await request(app.getHttpServer())
      .post('/sync/users')
      .expect(200);

    expect(response.body.recordsCreated).toBe(0);
    expect(response.body.recordsUpdated).toBe(2);

    const list = await request(app.getHttpServer())
      .get('/api/v1/users')
      .expect(200);
    expect(list.body.pagination.total).toBe(2);
  });

  it('a user missing from a later sync is soft-deleted and excluded by default', async () => {
    fetchAllUsers.mockResolvedValueOnce([externalUsers[0]]); // Turing disappears

    await request(app.getHttpServer()).post('/sync/users').expect(200);

    const active = await request(app.getHttpServer())
      .get('/api/v1/users')
      .expect(200);
    expect(active.body.pagination.total).toBe(1);
    expect(active.body.data[0].name).toBe('Ada Lovelace');

    const withDeleted = await request(app.getHttpServer())
      .get('/api/v1/users?includeDeleted=true')
      .expect(200);
    expect(withDeleted.body.pagination.total).toBe(2);
  });

  it('a reappearing user is reactivated instead of duplicated', async () => {
    fetchAllUsers.mockResolvedValueOnce(externalUsers); // Turing is back

    await request(app.getHttpServer()).post('/sync/users').expect(200);

    const active = await request(app.getHttpServer())
      .get('/api/v1/users')
      .expect(200);
    expect(active.body.pagination.total).toBe(2);
  });

  it('a customer API failure leaves previously synchronized data intact', async () => {
    fetchAllUsers.mockRejectedValueOnce(new Error('network down'));

    const response = await request(app.getHttpServer())
      .post('/sync/users')
      .expect(200);
    expect(response.body.status).toBe('FAILED');

    const list = await request(app.getHttpServer())
      .get('/api/v1/users')
      .expect(200);
    expect(list.body.pagination.total).toBe(2); // unchanged
  });

  it('rejects an out-of-range limit', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users?limit=500')
      .expect(400);
  });

  it('GET /api/v1/users/:id returns one user by internal id', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/users?search=Ada')
      .expect(200);
    const adaId = list.body.data[0].id;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/users/${adaId}`)
      .expect(200);

    expect(response.body.name).toBe('Ada Lovelace');
    expect(response.body.company).toBe('Analytical Engines');
  });

  it('GET /api/v1/users/:id returns 404 for an unknown id', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /api/v1/users/:id rejects a malformed id', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/not-a-uuid')
      .expect(400);
  });

  it('GET /api/v1/sync/runs lists past synchronization runs, most recent first', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/sync/runs')
      .expect(200);

    // Every sync triggered earlier in this suite should show up here.
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(5);
    const statuses = response.body.data.map(
      (r: { status: string }) => r.status,
    );
    expect(statuses).toContain('SUCCESS');
    expect(statuses).toContain('FAILED');

    // Most recent first.
    const startedTimes = response.body.data.map((r: { startedAt: string }) =>
      new Date(r.startedAt).getTime(),
    );
    const sorted = [...startedTimes].sort((a, b) => b - a);
    expect(startedTimes).toEqual(sorted);
  });
});
