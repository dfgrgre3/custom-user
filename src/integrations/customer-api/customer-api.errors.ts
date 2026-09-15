/** Raised whenever the customer API cannot be used to complete a sync. */
export class CustomerApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CustomerApiError';
  }
}

export class CustomerApiUnauthorizedError extends CustomerApiError {
  constructor(cause?: unknown) {
    super('Customer API rejected the configured admin token.', 401, cause);
    this.name = 'CustomerApiUnauthorizedError';
  }
}

export class CustomerApiUnavailableError extends CustomerApiError {
  constructor(cause?: unknown) {
    super(
      'Customer API is unreachable or returned a server error.',
      undefined,
      cause,
    );
    this.name = 'CustomerApiUnavailableError';
  }
}
