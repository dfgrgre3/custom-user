/**
 * Shapes exactly as returned by the external customer API
 * (verified against https://assessment-api-gamma.vercel.app/api/openapi).
 *
 * These types must never leak past the mapper: the mapper is the only
 * place that is allowed to know this shape exists.
 */

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
