export type ExternalUserStatus = 'active' | 'invited' | 'suspended';
export interface ExternalCompany {
    name: string;
    industry: string;
    role: string;
    website?: string;
    employees?: number;
}
export interface ExternalUser {
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: ExternalUserStatus;
    company: ExternalCompany;
    createdAt: string;
    updatedAt: string;
}
export interface ExternalPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}
export interface ExternalUserListResponse {
    data: ExternalUser[];
    pagination: ExternalPagination;
}
export interface ExternalErrorResponse {
    error: string;
    details?: Record<string, unknown>;
}
