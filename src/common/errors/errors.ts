/** Shared error boundary. Domain-specific errors belong with their own feature modules. */
export type ApplicationErrorCode =
  | 'VALIDATION'
  | 'EXTERNAL_API'
  | 'EXTERNAL_API_UNAUTHORIZED'
  | 'DATABASE'
  | 'BUSINESS'
  | 'UNEXPECTED';

export class SyncInProgressError extends Error {
  constructor(customerId: string) {
    super(`A synchronization for customer ${customerId} is already running.`);
    this.name = 'SyncInProgressError';
  }
}
