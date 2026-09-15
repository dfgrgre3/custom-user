import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

/**
 * Unversioned, unprefixed — like `POST /sync/users` — so it's reachable at
 * a fixed, predictable path (`/health`, not `/api/v1/health`) for uptime
 * monitors and the frontend's status indicator regardless of API versioning
 * changes. `VERSION_NEUTRAL` is required in addition to excluding the
 * global prefix: without it, Nest's URI versioning still prepends `/v1`.
 */
@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check',
    description:
      'Actually exercises Supabase and the customer API (a cheap real call to each), not just "the process is running." Returns HTTP 200 with status "ok" when both are healthy, HTTP 503 with status "error" and per-component detail otherwise.',
  })
  @ApiOkResponse({
    description: 'Both database and customer API are reachable.',
  })
  async check(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.check();
    res.status(
      result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return result;
  }
}
