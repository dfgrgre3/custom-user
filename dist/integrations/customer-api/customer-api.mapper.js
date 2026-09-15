"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapExternalUserToSyncedUserData = mapExternalUserToSyncedUserData;
function mapExternalUserToSyncedUserData(external) {
    return {
        externalUserId: external.id,
        name: external.name,
        email: external.email,
        phone: external.phone ?? null,
        status: external.status,
        companyName: external.company?.name ?? null,
        companyIndustry: external.company?.industry ?? null,
        companyRole: external.company?.role ?? null,
        companyWebsite: external.company?.website || null,
        companyEmployees: external.company?.employees ?? null,
        externalCreatedAt: new Date(external.createdAt),
        externalUpdatedAt: new Date(external.updatedAt),
    };
}
//# sourceMappingURL=customer-api.mapper.js.map