export type ApplicationErrorCode = 'VALIDATION' | 'EXTERNAL_API' | 'EXTERNAL_API_UNAUTHORIZED' | 'DATABASE' | 'BUSINESS' | 'UNEXPECTED';
export declare class SyncInProgressError extends Error {
    constructor(customerId: string);
}
