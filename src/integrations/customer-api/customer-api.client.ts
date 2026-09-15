import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  CustomerApiContractError,
  CustomerApiError,
  CustomerApiUnauthorizedError,
  CustomerApiUnavailableError,
} from './customer-api.errors';
import { externalUserListResponseSchema } from './customer-api.schema';
import { ExternalUser, ExternalUserListResponse } from './customer-api.types';

export interface CustomerApiClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  maxRetries: number;
  pageSize: number;
}

/**
 * Thin, token-aware HTTP client for one customer's external API.
 *
 * Isolated here on purpose: nothing outside this folder is allowed to know
 * about HTTP status codes, headers, pagination query params, or retry
 * timing for the customer API. Callers get back plain `ExternalUser[]`.
 */
@Injectable()
export class CustomerApiClient {
  private readonly logger = new Logger(CustomerApiClient.name);

  constructor(private readonly http: HttpService) {}

  /** Fetches every user page by page and returns the full, flat list. */
  async fetchAllUsers(
    options: CustomerApiClientOptions,
  ): Promise<ExternalUser[]> {
    const users: ExternalUser[] = [];
    const seenIds = new Set<string>();
    let page = 1;
    let totalPages = 1;

    do {
      const response = await this.fetchPage(options, page);
      // The schema already rejects duplicate ids *within* one page (see
      // customer-api.schema.ts); this additionally catches the same id
      // appearing across different pages — e.g. if the underlying dataset
      // shifts between page fetches (a user inserted mid-pagination shifts
      // every subsequent page's offset by one, re-serving a user we've
      // already seen). Either way, a duplicate here means the fetched
      // dataset can't be trusted, so the whole sync fails rather than
      // silently double-counting or letting the RPC's own duplicate check
      // fail confusingly deep in a much larger batch.
      for (const user of response.data) {
        if (seenIds.has(user.id)) {
          throw new CustomerApiContractError(
            `Duplicate external user id across pages: ${user.id}`,
          );
        }
        seenIds.add(user.id);
      }
      users.push(...response.data);
      totalPages = response.pagination.totalPages;
      page += 1;
    } while (page <= totalPages);

    return users;
  }

  private async fetchPage(
    options: CustomerApiClientOptions,
    page: number,
  ): Promise<ExternalUserListResponse> {
    const url = `${options.baseUrl.replace(/\/+$/, '')}/api/users`;

    return this.withRetry(options.maxRetries, async () => {
      let body: unknown;
      try {
        const response = await firstValueFrom(
          this.http.get<unknown>(url, {
            headers: { Authorization: `Bearer ${options.token}` },
            params: { page, limit: options.pageSize },
            timeout: options.timeoutMs,
          }),
        );
        body = response.data;
      } catch (error) {
        throw this.toCustomerApiError(error);
      }

      // Validated separately from the HTTP call above: a schema mismatch on
      // a 2xx response is a contract violation, not a transport failure,
      // and must not be retried or classified as CustomerApiUnavailableError.
      const parsed = externalUserListResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new CustomerApiContractError(parsed.error.message, parsed.error);
      }
      return parsed.data;
    });
  }

  /**
   * Status codes worth retrying even though most 4xx codes are not:
   *   - 408 Request Timeout, 425 Too Early — transient, request-level.
   *   - 429 Too Many Requests — rate limiting; the *next* attempt has a
   *     real chance of succeeding, unlike a malformed request or bad auth.
   *   - 5xx — server-side failures, generally transient.
   */
  private static readonly RETRYABLE_STATUS_CODES = new Set([
    408, 425, 429, 500, 502, 503, 504,
  ]);

  private async withRetry<T>(
    maxRetries: number,
    run: () => Promise<T>,
  ): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      try {
        return await run();
      } catch (error) {
        lastError = error;

        // Never retry auth failures or contract violations: neither
        // changes on a retry — the token is still bad, or the API will
        // still send back the same unexpected shape. Otherwise, only
        // retry status codes known to be transient (see
        // RETRYABLE_STATUS_CODES) rather than every non-2xx response.
        if (error instanceof CustomerApiUnauthorizedError) throw error;
        if (error instanceof CustomerApiContractError) throw error;
        if (
          error instanceof CustomerApiError &&
          !this.isRetryable(error.statusCode)
        ) {
          throw error;
        }

        attempt += 1;
        if (attempt > maxRetries) break;

        const backoffMs = this.computeBackoffMs(
          attempt,
          error instanceof CustomerApiError
            ? error.retryAfterSeconds
            : undefined,
        );
        this.logger.warn(
          `Customer API call failed (attempt ${attempt}/${maxRetries}); retrying in ${backoffMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  private isRetryable(statusCode?: number): boolean {
    // No status code at all means a network-level failure (timeout, DNS,
    // connection reset) rather than an HTTP response — always worth retrying.
    if (statusCode === undefined) return true;
    return CustomerApiClient.RETRYABLE_STATUS_CODES.has(statusCode);
  }

  /**
   * Honors the server's `Retry-After` header when given (exact, since the
   * server knows its own rate-limit window better than we can guess).
   * Otherwise falls back to exponential backoff with jitter: jitter avoids
   * every concurrent caller retrying at exactly the same instant and
   * re-creating the load spike that caused the failure (a "thundering herd").
   */
  private computeBackoffMs(
    attempt: number,
    retryAfterSeconds?: number,
  ): number {
    if (retryAfterSeconds !== undefined) {
      return Math.round(retryAfterSeconds * 1000);
    }
    const base = 2 ** (attempt - 1) * 250;
    const jitter = Math.random() * base * 0.25;
    return Math.round(base + jitter);
  }

  private parseRetryAfterSeconds(error: unknown): number | undefined {
    if (!isAxiosError(error)) return undefined;
    const header = error.response?.headers?.['retry-after'];
    if (!header) return undefined;

    const asNumber = Number(header);
    if (Number.isFinite(asNumber)) return asNumber;

    // Retry-After may also be an HTTP-date rather than a delay in seconds.
    const asDate = Date.parse(header);
    if (!Number.isNaN(asDate)) {
      return Math.max(0, (asDate - Date.now()) / 1000);
    }
    return undefined;
  }

  private toCustomerApiError(error: unknown): CustomerApiError {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const retryAfterSeconds = this.parseRetryAfterSeconds(error);

      if (status === 401 || status === 403) {
        return new CustomerApiUnauthorizedError(error);
      }
      if (status !== undefined && status >= 400 && status < 500) {
        const body = error.response?.data as { error?: string } | undefined;
        return new CustomerApiError(
          body?.error ?? `Customer API rejected the request (HTTP ${status}).`,
          status,
          error,
          retryAfterSeconds,
        );
      }
      return new CustomerApiUnavailableError(error, status, retryAfterSeconds);
    }
    return new CustomerApiUnavailableError(error);
  }
}

export type { ExternalUser };
