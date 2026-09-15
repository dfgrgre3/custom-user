import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Wraps the Supabase JS client, authenticated with the service_role key so
 * the backend can bypass row-level security (RLS) policies — this process
 * is a trusted server, not an end-user client.
 *
 * Connection is lazy: the client is created on first use rather than in
 * the constructor, mirroring the old PrismaService's deferred-connection
 * behavior so app startup never depends on Supabase being reachable.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('app.supabase.url');
    const serviceRoleKey = this.config.get<string>(
      'app.supabase.serviceRoleKey',
    );

    if (!url || !serviceRoleKey) {
      this.logger.warn(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set; database calls will fail until configured.',
      );
    }

    this.client = createClient(url ?? '', serviceRoleKey ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Raw Supabase client, for use by repositories/services in this module only. */
  getClient(): SupabaseClient {
    return this.client;
  }
}
