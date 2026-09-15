export type UserStatus = "active" | "invited" | "suspended";

export interface SyncedUser {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  company: string | null;
  companyIndustry: string | null;
  companyRole: string | null;
  isDeleted: boolean;
  sourceCreatedAt: string;
  sourceUpdatedAt: string;
  syncedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedUsers {
  data: SyncedUser[];
  pagination: PaginationMeta;
}

export type SyncRunStatus = "RUNNING" | "SUCCESS" | "FAILED";

export interface SyncRun {
  id: string;
  customerId: string;
  status: SyncRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  recordsFetched: number | null;
  recordsCreated: number | null;
  recordsUpdated: number | null;
  recordsDeleted: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface PaginatedSyncRuns {
  data: SyncRun[];
  pagination: PaginationMeta;
}

export interface TriggerSyncResult {
  syncRunId: string;
  status: "SUCCESS" | "FAILED";
  startedAt: string;
  completedAt: string;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface UsersListFilters {
  company?: string;
  search?: string;
  status?: UserStatus | "";
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
}

export type ComponentStatus = "ok" | "error";

export interface HealthStatus {
  status: ComponentStatus;
  components: {
    database: { status: ComponentStatus; error?: string };
    customerApi: { status: ComponentStatus; error?: string };
  };
}
