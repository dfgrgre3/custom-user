"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CustomerApiClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerApiClient = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const axios_2 = require("axios");
const rxjs_1 = require("rxjs");
const customer_api_errors_1 = require("./customer-api.errors");
const customer_api_schema_1 = require("./customer-api.schema");
let CustomerApiClient = class CustomerApiClient {
    static { CustomerApiClient_1 = this; }
    http;
    logger = new common_1.Logger(CustomerApiClient_1.name);
    constructor(http) {
        this.http = http;
    }
    async fetchAllUsers(options) {
        const users = [];
        const seenIds = new Set();
        let page = 1;
        let totalPages = 1;
        do {
            const response = await this.fetchPage(options, page);
            for (const user of response.data) {
                if (seenIds.has(user.id)) {
                    throw new customer_api_errors_1.CustomerApiContractError(`Duplicate external user id across pages: ${user.id}`);
                }
                seenIds.add(user.id);
            }
            users.push(...response.data);
            totalPages = response.pagination.totalPages;
            page += 1;
        } while (page <= totalPages);
        return users;
    }
    async fetchPage(options, page) {
        const url = `${options.baseUrl.replace(/\/+$/, '')}/api/users`;
        return this.withRetry(options.maxRetries, async () => {
            let body;
            try {
                const response = await (0, rxjs_1.firstValueFrom)(this.http.get(url, {
                    headers: { Authorization: `Bearer ${options.token}` },
                    params: { page, limit: options.pageSize },
                    timeout: options.timeoutMs,
                }));
                body = response.data;
            }
            catch (error) {
                throw this.toCustomerApiError(error);
            }
            const parsed = customer_api_schema_1.externalUserListResponseSchema.safeParse(body);
            if (!parsed.success) {
                throw new customer_api_errors_1.CustomerApiContractError(parsed.error.message, parsed.error);
            }
            return parsed.data;
        });
    }
    static RETRYABLE_STATUS_CODES = new Set([
        408, 425, 429, 500, 502, 503, 504,
    ]);
    async withRetry(maxRetries, run) {
        let attempt = 0;
        let lastError;
        while (attempt <= maxRetries) {
            try {
                return await run();
            }
            catch (error) {
                lastError = error;
                if (error instanceof customer_api_errors_1.CustomerApiUnauthorizedError)
                    throw error;
                if (error instanceof customer_api_errors_1.CustomerApiContractError)
                    throw error;
                if (error instanceof customer_api_errors_1.CustomerApiError &&
                    !this.isRetryable(error.statusCode)) {
                    throw error;
                }
                attempt += 1;
                if (attempt > maxRetries)
                    break;
                const backoffMs = this.computeBackoffMs(attempt, error instanceof customer_api_errors_1.CustomerApiError
                    ? error.retryAfterSeconds
                    : undefined);
                this.logger.warn(`Customer API call failed (attempt ${attempt}/${maxRetries}); retrying in ${backoffMs}ms`);
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
            }
        }
        throw lastError;
    }
    isRetryable(statusCode) {
        if (statusCode === undefined)
            return true;
        return CustomerApiClient_1.RETRYABLE_STATUS_CODES.has(statusCode);
    }
    computeBackoffMs(attempt, retryAfterSeconds) {
        if (retryAfterSeconds !== undefined) {
            return Math.round(retryAfterSeconds * 1000);
        }
        const base = 2 ** (attempt - 1) * 250;
        const jitter = Math.random() * base * 0.25;
        return Math.round(base + jitter);
    }
    parseRetryAfterSeconds(error) {
        if (!(0, axios_2.isAxiosError)(error))
            return undefined;
        const header = error.response?.headers?.['retry-after'];
        if (!header)
            return undefined;
        const asNumber = Number(header);
        if (Number.isFinite(asNumber))
            return asNumber;
        const asDate = Date.parse(header);
        if (!Number.isNaN(asDate)) {
            return Math.max(0, (asDate - Date.now()) / 1000);
        }
        return undefined;
    }
    toCustomerApiError(error) {
        if ((0, axios_2.isAxiosError)(error)) {
            const status = error.response?.status;
            const retryAfterSeconds = this.parseRetryAfterSeconds(error);
            if (status === 401 || status === 403) {
                return new customer_api_errors_1.CustomerApiUnauthorizedError(error);
            }
            if (status !== undefined && status >= 400 && status < 500) {
                const body = error.response?.data;
                return new customer_api_errors_1.CustomerApiError(body?.error ?? `Customer API rejected the request (HTTP ${status}).`, status, error, retryAfterSeconds);
            }
            return new customer_api_errors_1.CustomerApiUnavailableError(error, status, retryAfterSeconds);
        }
        return new customer_api_errors_1.CustomerApiUnavailableError(error);
    }
};
exports.CustomerApiClient = CustomerApiClient;
exports.CustomerApiClient = CustomerApiClient = CustomerApiClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], CustomerApiClient);
//# sourceMappingURL=customer-api.client.js.map