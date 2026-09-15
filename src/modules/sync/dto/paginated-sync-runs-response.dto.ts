import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../users/dto/paginated-users-response.dto';
import { SyncRunResponseDto } from './sync-run-response.dto';

export class PaginatedSyncRunsResponseDto {
  @ApiProperty({ type: [SyncRunResponseDto] })
  data!: SyncRunResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
