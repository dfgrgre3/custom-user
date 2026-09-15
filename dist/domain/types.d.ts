export type UserStatus = 'active' | 'invited' | 'suspended';
export type SyncRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';
export interface Customer {
    id: string;
    name: string;
    apiBaseUrl: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface User {
    id: string;
    customerId: string;
    externalUserId: string;
    name: string;
    email: string;
    phone: string | null;
    status: UserStatus;
    companyName: string | null;
    companyIndustry: string | null;
    companyRole: string | null;
    companyWebsite: string | null;
    companyEmployees: number | null;
    externalCreatedAt: Date;
    externalUpdatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}
export interface SyncRun {
    id: string;
    customerId: string;
    status: SyncRunStatus;
    startedAt: Date;
    completedAt: Date | null;
    recordsFetched: number | null;
    recordsCreated: number | null;
    recordsUpdated: number | null;
    recordsDeleted: number | null;
    errorCode: string | null;
    errorMessage: string | null;
}
export interface CustomerRow {
    id: string;
    name: string;
    api_base_url: string;
    created_at: string;
    updated_at: string;
}
export interface UserRow {
    id: string;
    customer_id: string;
    external_user_id: string;
    name: string;
    email: string;
    phone: string | null;
    status: UserStatus;
    company_name: string | null;
    company_industry: string | null;
    company_role: string | null;
    company_website: string | null;
    company_employees: number | null;
    external_created_at: string;
    external_updated_at: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}
export interface SyncRunRow {
    id: string;
    customer_id: string;
    status: SyncRunStatus;
    started_at: string;
    completed_at: string | null;
    records_fetched: number | null;
    records_created: number | null;
    records_updated: number | null;
    records_deleted: number | null;
    error_code: string | null;
    error_message: string | null;
}
export declare function mapCustomerRow(row: CustomerRow): Customer;
export declare function mapUserRow(row: UserRow): User;
export declare function mapSyncRunRow(row: SyncRunRow): SyncRun;
