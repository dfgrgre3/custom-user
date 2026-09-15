import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

export const ROLES_KEY = 'auth.roles';
/**
 * Requires the verified JWT's `app_metadata.role` (or top-level `role`,
 * whichever Supabase populates) to be one of the given roles. Apply
 * alongside `@UseGuards(SupabaseAuthGuard)` — the guard checks this
 * metadata itself, this decorator just declares which roles a route needs.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedRequest extends Request {
  user: JWTPayload & { role?: string };
}

/**
 * Verifies the bearer token on every route it guards against Supabase
 * Auth's own JWKS endpoint — the same JWTs Supabase issues to signed-in
 * users. This is deliberately NOT a hand-rolled auth system: Supabase Auth
 * already exists and is what SUPABASE_JWKS_URL points at, so verifying
 * against it (rather than inventing a parallel token scheme) means there is
 * exactly one place a user's identity and session come from.
 *
 * The JWKS itself is fetched once and cached/auto-refreshed by `jose`'s
 * `createRemoteJWKSet` (keyed by SUPABASE_JWKS_URL), not re-fetched per
 * request.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const payload = await this.verify(token);
    request.user = payload as AuthenticatedRequest['user'];

    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (requiredRoles && requiredRoles.length > 0) {
      const role =
        (payload as { role?: string }).role ??
        (payload as { app_metadata?: { role?: string } }).app_metadata?.role;
      if (!role || !requiredRoles.includes(role)) {
        throw new UnauthorizedException(
          `This action requires one of the following roles: ${requiredRoles.join(', ')}.`,
        );
      }
    }

    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim() || null;
  }

  private async verify(token: string): Promise<JWTPayload> {
    if (!this.jwks) {
      const jwksUrl = this.config.get<string>('app.supabase.jwksUrl');
      if (!jwksUrl) {
        // Fails closed: if JWKS isn't configured, no token can ever be
        // verified, so every request is rejected rather than silently
        // trusting unverifiable tokens.
        throw new UnauthorizedException(
          'Authentication is not configured on this server.',
        );
      }
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks);
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
