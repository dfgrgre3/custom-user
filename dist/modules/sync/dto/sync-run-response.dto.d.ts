import { SyncRun } from '../../../domain/types';
export declare class SyncRunResponseDto {
    id: string;
    customerId: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    durationMs: number | null;
    recordsFetched: number | null;
    recordsCreated: number | null;
    recordsUpdated: number | null;
    recordsDeleted: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    static fromEntity(run: SyncRun): SyncRunResponseDto;
}
