import { UserStatus } from '../../domain/types';
import { ExternalUser } from './customer-api.types';

/** Internal representation of a synchronized user, independent of any customer's API shape. */
export interface SyncedUserData {
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
}

/**
 * Translates the customer API's `ExternalUser` into our internal
 * representation. This is the single seam between "their schema" and
 * "our schema" — nothing else should reach into `ExternalUser` directly.
 */
export function mapExternalUserToSyncedUserData(
  external: ExternalUser,
): SyncedUserData {
  return {
    externalUserId: external.id,
    name: external.name,
    email: external.email,
    phone: external.phone ?? null,
    status: external.status as UserStatus,
    companyName: external.company?.name ?? null,
    companyIndustry: external.company?.industry ?? null,
    companyRole: external.company?.role ?? null,
    companyWebsite: external.company?.website || null,
    companyEmployees: external.company?.employees ?? null,
    externalCreatedAt: new Date(external.createdAt),
    externalUpdatedAt: new Date(external.updatedAt),
  };
}
