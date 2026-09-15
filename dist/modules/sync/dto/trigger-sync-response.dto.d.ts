export declare class TriggerSyncResponseDto {
    syncRunId: string;
    status: 'SUCCESS' | 'FAILED';
    startedAt: Date;
    completedAt: Date;
    recordsFetched: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errorCode?: string | null;
    errorMessage?: string | null;
}
