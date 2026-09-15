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

/**
 * Raised when the customer API responds successfully (HTTP 2xx) but the
 * body doesn't match the contract we validate against (see
 * customer-api.schema.ts) — e.g. an unexpected `status` value, a missing
 * field, or `data` not being an array. Distinct from `CustomerApiError`
 * (transport/HTTP-level failures) because this is a data-contract failure:
 * treating it the same as "server error" would make it look retryable when
 * it isn't — the response won't change shape on retry.
 */
export class CustomerApiContractError extends CustomerApiError {
  constructor(message: string, cause?: unknown) {
    super(
      `Customer API response violated the expected contract: ${message}`,
      undefined,
      cause,
    );
    this.name = 'CustomerApiContractError';
  }
}
