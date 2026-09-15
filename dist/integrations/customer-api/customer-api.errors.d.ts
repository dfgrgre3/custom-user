export declare class CustomerApiError extends Error {
    readonly statusCode?: number | undefined;
    readonly cause?: unknown | undefined;
    readonly retryAfterSeconds?: number | undefined;
    constructor(message: string, statusCode?: number | undefined, cause?: unknown | undefined, retryAfterSeconds?: number | undefined);
}
export declare class CustomerApiUnauthorizedError extends CustomerApiError {
    constructor(cause?: unknown);
}
export declare class CustomerApiUnavailableError extends CustomerApiError {
    constructor(cause?: unknown, statusCode?: number, retryAfterSeconds?: number);
}
export declare class CustomerApiContractError extends CustomerApiError {
    constructor(message: string, cause?: unknown);
}
