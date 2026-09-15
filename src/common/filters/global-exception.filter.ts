import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Catches everything Nest's own exception handling doesn't recognize as an
 * `HttpException` — i.e. every plain `throw new Error(...)` from a
 * repository or service (`Failed to list users: ${error.message}`, raw
 * Postgres/PostgREST error text, Supabase client errors, etc.). Without
 * this, Nest's default handler serializes an uncaught error's `message`
 * straight into the HTTP response body, which can include internal details
 * (table/column names, constraint names, connection info) that have no
 * business reaching a client.
 *
 * `HttpException`s (NotFoundException, ConflictException, ValidationPipe's
 * 400s, ...) are intentionally passed through unchanged — those are
 * already deliberately-shaped, business-safe responses.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong.',
    });
  }
}
