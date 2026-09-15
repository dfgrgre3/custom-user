import { ListSyncRunsQueryDto } from './dto/list-sync-runs-query.dto';
import { PaginatedSyncRunsResponseDto } from './dto/paginated-sync-runs-response.dto';
import { TriggerSyncResponseDto } from './dto/trigger-sync-response.dto';
import { SyncService } from './sync.service';
declare class TriggerSyncDto {
    customerId?: string;
}
export declare class SyncController {
    private readonly syncService;
    constructor(syncService: SyncService);
    syncUsers(body: TriggerSyncDto): Promise<TriggerSyncResponseDto>;
}
export declare class SyncRunsController {
    private readonly syncService;
    constructor(syncService: SyncService);
    listRuns(query: ListSyncRunsQueryDto): Promise<PaginatedSyncRunsResponseDto>;
}
export {};
