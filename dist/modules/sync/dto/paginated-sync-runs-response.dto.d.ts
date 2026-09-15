import { PaginationMetaDto } from '../../users/dto/paginated-users-response.dto';
import { SyncRunResponseDto } from './sync-run-response.dto';
export declare class PaginatedSyncRunsResponseDto {
    data: SyncRunResponseDto[];
    pagination: PaginationMetaDto;
}
