"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCustomerRow = mapCustomerRow;
exports.mapUserRow = mapUserRow;
exports.mapSyncRunRow = mapSyncRunRow;
function mapCustomerRow(row) {
    return {
        id: row.id,
        name: row.name,
        apiBaseUrl: row.api_base_url,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}
function mapUserRow(row) {
    return {
        id: row.id,
        customerId: row.customer_id,
        externalUserId: row.external_user_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        companyName: row.company_name,
        companyIndustry: row.company_industry,
        companyRole: row.company_role,
        companyWebsite: row.company_website,
        companyEmployees: row.company_employees,
        externalCreatedAt: new Date(row.external_created_at),
        externalUpdatedAt: new Date(row.external_updated_at),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    };
}
function mapSyncRunRow(row) {
    return {
        id: row.id,
        customerId: row.customer_id,
        status: row.status,
        startedAt: new Date(row.started_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : null,
        recordsFetched: row.records_fetched,
        recordsCreated: row.records_created,
        recordsUpdated: row.records_updated,
        recordsDeleted: row.records_deleted,
        errorCode: row.error_code,
        errorMessage: row.error_message,
    };
}
//# sourceMappingURL=types.js.map