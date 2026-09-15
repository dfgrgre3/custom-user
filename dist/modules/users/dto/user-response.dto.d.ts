import { User } from '../../../domain/types';
export declare class UserResponseDto {
    id: string;
    customerId: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    company: string | null;
    companyIndustry: string | null;
    companyRole: string | null;
    isDeleted: boolean;
    sourceCreatedAt: Date;
    sourceUpdatedAt: Date;
    syncedAt: Date;
    static fromEntity(user: User): UserResponseDto;
}
