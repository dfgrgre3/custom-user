import { HttpService } from '@nestjs/axios';
import { ExternalUser } from './customer-api.types';
export interface CustomerApiClientOptions {
    baseUrl: string;
    token: string;
    timeoutMs: number;
    maxRetries: number;
    pageSize: number;
}
export declare class CustomerApiClient {
    private readonly http;
    private readonly logger;
    constructor(http: HttpService);
    fetchAllUsers(options: CustomerApiClientOptions): Promise<ExternalUser[]>;
    private fetchPage;
    private static readonly RETRYABLE_STATUS_CODES;
    private withRetry;
    private isRetryable;
    private computeBackoffMs;
    private parseRetryAfterSeconds;
    private toCustomerApiError;
}
export type { ExternalUser };
