import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import {
  Roles,
  SupabaseAuthGuard,
} from '../../common/auth/supabase-auth.guard';
import { SyncInProgressError } from '../../common/errors/errors';
import { ListSyncRunsQueryDto } from './dto/list-sync-runs-query.dto';
import { PaginatedSyncRunsResponseDto } from './dto/paginated-sync-runs-response.dto';
import { SyncRunResponseDto } from './dto/sync-run-response.dto';
import { TriggerSyncResponseDto } from './dto/trigger-sync-response.dto';
import { SyncService } from './sync.service';

class TriggerSyncDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Customer to sync. Defaults to the configured default customer when omitted.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

/**
 * Triggers writes against the customer dataset — restricted to the
 * `admin` role rather than any authenticated user.
 */
@ApiTags('Sync')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing/invalid token, or not an admin.',
})
@UseGuards(SupabaseAuthGuard)
@Roles('admin')
@Controller({ path: 'sync', version: VERSION_NEUTRAL })
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Synchronize users from the customer API',
    description:
      'Safe to call repeatedly. Fetches the full external dataset, upserts changed/new users, ' +
      'and soft-deletes users that disappeared from the customer dataset. Returns 200 with a ' +
      'FAILED status (not an HTTP error) when the customer API is unreachable, so previously ' +
      'synchronized data is never touched.',
  })
  @ApiBody({ type: TriggerSyncDto, required: false })
  @ApiOkResponse({ type: TriggerSyncResponseDto })
  @ApiConflictResponse({
    description: 'A synchronization for this customer is already running.',
  })
  async syncUsers(
    @Body() body: TriggerSyncDto,
  ): Promise<TriggerSyncResponseDto> {
    let run;
    try {
      run = await this.syncService.syncCustomer(body?.customerId);
    } catch (error) {
      if (error instanceof SyncInProgressError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    return {
      syncRunId: run.id,
      status: run.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      startedAt: run.startedAt,
      completedAt: run.completedAt!,
      recordsFetched: run.recordsFetched ?? 0,
      recordsCreated: run.recordsCreated ?? 0,
      recordsUpdated: run.recordsUpdated ?? 0,
      recordsDeleted: run.recordsDeleted ?? 0,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
    };
  }
}

/**
 * Separate controller (rather than a second method on SyncController) so
 * this endpoint can live under the normal `/api/v1` prefix and versioning,
 * while POST /sync/users keeps its own unversioned, unprefixed route.
 *
 * Operational history — restricted to admin/operations roles, same as the
 * sync trigger itself, rather than any authenticated user.
 */
@ApiTags('Sync')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing/invalid token, or not an admin.',
})
@UseGuards(SupabaseAuthGuard)
@Roles('admin')
@Controller({ path: 'sync', version: '1' })
export class SyncRunsController {
  constructor(private readonly syncService: SyncService) {}

  @Get('runs')
  @ApiOperation({
    summary: 'List past synchronization runs',
    description:
      'Operational history: one row per POST /sync/users call, most recent first.',
  })
  @ApiOkResponse({ type: PaginatedSyncRunsResponseDto })
  async listRuns(
    @Query() query: ListSyncRunsQueryDto,
  ): Promise<PaginatedSyncRunsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const customerId = await this.syncService.resolveCustomerId(
      query.customerId,
    );
    const { data, total } = await this.syncService.listRuns(
      customerId,
      page,
      limit,
    );

    return {
      data: data.map((run) => SyncRunResponseDto.fromEntity(run)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
