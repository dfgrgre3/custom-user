import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  CustomerApiError,
  CustomerApiUnauthorizedError,
  CustomerApiUnavailableError,
} from './customer-api.errors';
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
    let page = 1;
    let totalPages = 1;

    do {
      const response = await this.fetchPage(options, page);
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
      try {
        const response = await firstValueFrom(
          this.http.get<ExternalUserListResponse>(url, {
            headers: { Authorization: `Bearer ${options.token}` },
            params: { page, limit: options.pageSize },
            timeout: options.timeoutMs,
          }),
        );
        return response.data;
      } catch (error) {
        throw this.toCustomerApiError(error);
      }
    });
  }

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

        // Never retry auth failures or client (4xx) errors: the request
        // itself is wrong/unauthorized and retrying will not help.
        if (error instanceof CustomerApiUnauthorizedError) throw error;
        if (
          error instanceof CustomerApiError &&
          this.isNonRetryable(error.statusCode)
        ) {
          throw error;
        }

        attempt += 1;
        if (attempt > maxRetries) break;

        const backoffMs = 2 ** (attempt - 1) * 250;
        this.logger.warn(
          `Customer API call failed (attempt ${attempt}/${maxRetries}); retrying in ${backoffMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  private isNonRetryable(statusCode?: number): boolean {
    return statusCode !== undefined && statusCode >= 400 && statusCode < 500;
  }

  private toCustomerApiError(error: unknown): CustomerApiError {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        return new CustomerApiUnauthorizedError(error);
      }
      if (status !== undefined && status >= 400 && status < 500) {
        const body = error.response?.data as { error?: string } | undefined;
        return new CustomerApiError(
          body?.error ?? `Customer API rejected the request (HTTP ${status}).`,
          status,
          error,
        );
      }
      return new CustomerApiUnavailableError(error);
    }
    return new CustomerApiUnavailableError(error);
  }
}

export type { ExternalUser };
