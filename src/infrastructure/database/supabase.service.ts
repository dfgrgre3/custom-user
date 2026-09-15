import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Wraps the Supabase JS client, authenticated with the service_role key so
 * the backend can bypass row-level security (RLS) policies — this process
 * is a trusted server, not an end-user client.
 *
 * `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are validated as required at
 * application startup (see config/configuration.schema.ts) — Nest never
 * finishes bootstrapping without them — so this can assume they're present
 * rather than warning and continuing with an unusable client.
 *
 * Connection is otherwise lazy: the client is created on first use rather
 * than in the constructor, so app startup never depends on Supabase being
 * reachable over the network — only on its credentials being configured.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private client!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('app.supabase.url')!;
    const serviceRoleKey = this.config.get<string>(
      'app.supabase.serviceRoleKey',
    )!;

    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Raw Supabase client, for use by repositories/services in this module only. */
  getClient(): SupabaseClient {
    return this.client;
  }
}
