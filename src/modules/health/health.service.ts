import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../infrastructure/database/supabase.service';

export type ComponentStatus = 'ok' | 'error';

export interface HealthCheckResult {
  status: ComponentStatus;
  components: {
    database: { status: ComponentStatus; error?: string };
    customerApi: { status: ComponentStatus; error?: string };
  };
}

/**
 * Backs `GET /health`. Actually exercises both external dependencies —
 * Supabase and the customer API — rather than just reporting "the process
 * is running," which is the one thing a health check can't usefully tell
 * you (if the process weren't running, nothing would answer the request at
 * all). This is what the frontend's "System" status indicator polls,
 * replacing a previously hardcoded "Ready" label that reflected no real
 * signal.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [database, customerApi] = await Promise.all([
      this.checkDatabase(),
      this.checkCustomerApi(),
    ]);

    return {
      status:
        database.status === 'ok' && customerApi.status === 'ok'
          ? 'ok'
          : 'error',
      components: { database, customerApi },
    };
  }

  private async checkDatabase(): Promise<{
    status: ComponentStatus;
    error?: string;
  }> {
    try {
      // Cheapest possible real query: HEAD + count, no rows transferred.
      const { error } = await this.supabase
        .getClient()
        .from('customers')
        .select('id', { count: 'exact', head: true });
      if (error) {
        return { status: 'error', error: error.message };
      }
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkCustomerApi(): Promise<{
    status: ComponentStatus;
    error?: string;
  }> {
    const baseUrl = this.config.get<string>('app.customer.apiBaseUrl')!;
    const token = this.config.get<string>('app.customer.apiToken')!;

    try {
      // A minimal, cheap real request — one user, not a full sync — just to
      // confirm the API is reachable and the configured token is accepted.
      await firstValueFrom(
        this.http.get(`${baseUrl.replace(/\/+$/, '')}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page: 1, limit: 1 },
          timeout: 5000,
        }),
      );
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
