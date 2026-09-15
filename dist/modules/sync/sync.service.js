"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const errors_1 = require("../../common/errors/errors");
const supabase_service_1 = require("../../infrastructure/database/supabase.service");
const customer_api_client_1 = require("../../integrations/customer-api/customer-api.client");
const customer_api_errors_1 = require("../../integrations/customer-api/customer-api.errors");
const customer_api_mapper_1 = require("../../integrations/customer-api/customer-api.mapper");
const customers_service_1 = require("../customers/customers.service");
const types_1 = require("../../domain/types");
const SYNC_ALREADY_RUNNING_CODE = 'P0001';
let SyncService = SyncService_1 = class SyncService {
    supabase;
    customerApiClient;
    customersService;
    config;
    logger = new common_1.Logger(SyncService_1.name);
    constructor(supabase, customerApiClient, customersService, config) {
        this.supabase = supabase;
        this.customerApiClient = customerApiClient;
        this.customersService = customersService;
        this.config = config;
    }
    async syncCustomer(customerId) {
        const customer = customerId
            ? await this.customersService.findById(customerId)
            : await this.customersService.getOrCreateDefaultCustomer();
        if (!customer) {
            throw new Error(`Unknown customer: ${customerId}`);
        }
        const client = this.supabase.getClient();
        const { data: createdRun, error: createRunError } = await client
            .rpc('start_sync_run', { p_customer_id: customer.id })
            .single();
        if (createRunError) {
            if (createRunError.code === SYNC_ALREADY_RUNNING_CODE) {
                throw new errors_1.SyncInProgressError(customer.id);
            }
            throw new Error(`Failed to create sync run: ${createRunError.message}`);
        }
        if (!createdRun) {
            throw new Error('Failed to create sync run: no row returned.');
        }
        const syncRunId = createdRun.id;
        try {
            const token = this.config.get('app.customer.apiToken');
            const externalUsers = await this.customerApiClient.fetchAllUsers({
                baseUrl: customer.apiBaseUrl,
                token,
                timeoutMs: this.config.get('app.customer.timeoutMs'),
                maxRetries: this.config.get('app.customer.maxRetries'),
                pageSize: this.config.get('app.customer.pageSize'),
            });
            const payload = externalUsers.map((externalUser) => {
                const data = (0, customer_api_mapper_1.mapExternalUserToSyncedUserData)(externalUser);
                return {
                    externalUserId: data.externalUserId,
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    status: data.status,
                    companyName: data.companyName,
                    companyIndustry: data.companyIndustry,
                    companyRole: data.companyRole,
                    companyWebsite: data.companyWebsite,
                    companyEmployees: data.companyEmployees,
                    externalCreatedAt: data.externalCreatedAt.toISOString(),
                    externalUpdatedAt: data.externalUpdatedAt.toISOString(),
                };
            });
            const { data: completedRow, error: completeError } = await client
                .rpc('complete_sync_run', {
                p_sync_run_id: syncRunId,
                p_customer_id: customer.id,
                p_users: payload,
            })
                .single();
            if (completeError || !completedRow) {
                throw new Error(`Failed to complete sync run: ${completeError?.message}`);
            }
            this.logger.log(`sync.completed customerId=${customer.id} fetched=${completedRow.records_fetched} created=${completedRow.records_created} updated=${completedRow.records_updated} deleted=${completedRow.records_deleted}`);
            return (0, types_1.mapSyncRunRow)(completedRow);
        }
        catch (error) {
            const { code, message } = this.classifyError(error);
            this.logger.error(`sync.failed customerId=${customer.id} code=${code} message=${message}`);
            const { data: failedRow, error: failError } = await client
                .rpc('fail_sync_run', {
                p_sync_run_id: syncRunId,
                p_error_code: code,
                p_error_message: message,
            })
                .single();
            if (failError || !failedRow) {
                throw new Error(`Failed to record sync run failure: ${failError?.message}`);
            }
            return (0, types_1.mapSyncRunRow)(failedRow);
        }
    }
    async listRuns(customerId, page, limit) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const { data, count, error } = await this.supabase
            .getClient()
            .from('sync_runs')
            .select('*', { count: 'exact' })
            .eq('customer_id', customerId)
            .order('started_at', { ascending: false })
            .range(from, to);
        if (error) {
            throw new Error(`Failed to list sync runs: ${error.message}`);
        }
        return {
            data: (data ?? []).map(types_1.mapSyncRunRow),
            total: count ?? 0,
        };
    }
    async resolveCustomerId(customerId) {
        if (customerId)
            return customerId;
        const customer = await this.customersService.getOrCreateDefaultCustomer();
        return customer.id;
    }
    classifyError(error) {
        if (error instanceof customer_api_errors_1.CustomerApiError) {
            let code = 'EXTERNAL_API';
            if (error.name === 'CustomerApiUnauthorizedError') {
                code = 'EXTERNAL_API_UNAUTHORIZED';
            }
            else if (error.name === 'CustomerApiContractError') {
                code = 'EXTERNAL_API_CONTRACT_VIOLATION';
            }
            return { code, message: error.message };
        }
        if (error instanceof Error) {
            return { code: 'UNEXPECTED', message: error.message };
        }
        return {
            code: 'UNEXPECTED',
            message: 'Unknown error during synchronization.',
        };
    }
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = SyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        customer_api_client_1.CustomerApiClient,
        customers_service_1.CustomersService,
        config_1.ConfigService])
], SyncService);
//# sourceMappingURL=sync.service.js.map