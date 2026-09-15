import { UserStatus } from '../../domain/types';
import { ExternalUser } from './customer-api.types';
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
export declare function mapExternalUserToSyncedUserData(external: ExternalUser): SyncedUserData;
