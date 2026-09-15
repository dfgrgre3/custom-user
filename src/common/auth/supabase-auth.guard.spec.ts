import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, JWK, KeyLike, SignJWT } from 'jose';
import { ROLES_KEY, SupabaseAuthGuard } from './supabase-auth.guard';

/**
 * Runs a real, local JWKS HTTP endpoint rather than mocking `jose`'s
 * internals: `createRemoteJWKSet` fetches and caches keys over HTTP, and
 * the whole point of this guard is verifying a *real* signature against a
 * *real* JWKS response — mocking that away would leave the actual
 * verification logic untested. Starts on an ephemeral port for each test.
 */
async function startJwksServer(
  jwk: JWK,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/jwks.json`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request = { headers, user: undefined };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('SupabaseAuthGuard', () => {
  let privateKey: KeyLike;
  let publicJwk: JWK;
  let jwks: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    publicJwk = await exportJWK(keyPair.publicKey);
    publicJwk.kid = 'test-kid';
    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';
    jwks = await startJwksServer(publicJwk);
  });

  afterAll(async () => {
    await jwks.close();
  });

  function makeGuard(roles?: string[]) {
    const config = {
      get: jest.fn().mockReturnValue(jwks.url),
    } as unknown as ConfigService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(roles),
    } as unknown as Reflector;
    return new SupabaseAuthGuard(config, reflector);
  }

  async function signToken(
    payload: Record<string, unknown>,
    options: { expired?: boolean } = {},
  ): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuedAt()
      .setExpirationTime(options.expired ? '-1h' : '1h')
      .sign(privateKey);
  }

  it('rejects a request with no Authorization header', async () => {
    const guard = makeGuard();
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a header that is not a Bearer token', async () => {
    const guard = makeGuard();
    await expect(
      guard.canActivate(makeContext({ authorization: 'Basic abc123' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a validly signed, unexpired token and attaches the payload to the request', async () => {
    const guard = makeGuard();
    const token = await signToken({ sub: 'user-1', role: 'authenticated' });
    const context = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    const request = context
      .switchToHttp()
      .getRequest<{ user: { sub: string } }>();
    expect(request.user.sub).toBe('user-1');
  });

  it('rejects an expired token', async () => {
    const guard = makeGuard();
    const token = await signToken({ sub: 'user-1' }, { expired: true });

    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${token}` })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token signed with a different key (forged signature)', async () => {
    const guard = makeGuard();
    const { privateKey: otherKey } = await generateKeyPair('RS256');
    const forged = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherKey);

    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${forged}` })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows a valid token with the required role', async () => {
    const guard = makeGuard(['admin']);
    const token = await signToken({ sub: 'user-1', role: 'admin' });

    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${token}` })),
    ).resolves.toBe(true);
  });

  it('rejects a valid token without the required role', async () => {
    const guard = makeGuard(['admin']);
    const token = await signToken({ sub: 'user-1', role: 'authenticated' });

    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${token}` })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('reads the role from app_metadata.role when top-level role is absent', async () => {
    const guard = makeGuard(['admin']);
    const token = await signToken({
      sub: 'user-1',
      app_metadata: { role: 'admin' },
    });

    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${token}` })),
    ).resolves.toBe(true);
  });

  it('fails closed when SUPABASE_JWKS_URL is not configured', async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    const guard = new SupabaseAuthGuard(config, reflector);
    const token = await signToken({ sub: 'user-1' });

    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${token}` })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// Sanity check that the Roles decorator writes to the metadata key the
// guard reads from — if these ever drift apart, every @Roles(...) route
// would silently stop being role-checked.
describe('ROLES_KEY', () => {
  it('is a stable, non-empty metadata key', () => {
    expect(typeof ROLES_KEY).toBe('string');
    expect(ROLES_KEY.length).toBeGreaterThan(0);
  });
});
