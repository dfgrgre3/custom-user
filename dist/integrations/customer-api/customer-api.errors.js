"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerApiContractError = exports.CustomerApiUnavailableError = exports.CustomerApiUnauthorizedError = exports.CustomerApiError = void 0;
class CustomerApiError extends Error {
    statusCode;
    cause;
    retryAfterSeconds;
    constructor(message, statusCode, cause, retryAfterSeconds) {
        super(message);
        this.statusCode = statusCode;
        this.cause = cause;
        this.retryAfterSeconds = retryAfterSeconds;
        this.name = 'CustomerApiError';
    }
}
exports.CustomerApiError = CustomerApiError;
class CustomerApiUnauthorizedError extends CustomerApiError {
    constructor(cause) {
        super('Customer API rejected the configured admin token.', 401, cause);
        this.name = 'CustomerApiUnauthorizedError';
    }
}
exports.CustomerApiUnauthorizedError = CustomerApiUnauthorizedError;
class CustomerApiUnavailableError extends CustomerApiError {
    constructor(cause, statusCode, retryAfterSeconds) {
        super('Customer API is unreachable or returned a server error.', statusCode, cause, retryAfterSeconds);
        this.name = 'CustomerApiUnavailableError';
    }
}
exports.CustomerApiUnavailableError = CustomerApiUnavailableError;
class CustomerApiContractError extends CustomerApiError {
    constructor(message, cause) {
        super(`Customer API response violated the expected contract: ${message}`, undefined, cause);
        this.name = 'CustomerApiContractError';
    }
}
exports.CustomerApiContractError = CustomerApiContractError;
//# sourceMappingURL=customer-api.errors.js.map