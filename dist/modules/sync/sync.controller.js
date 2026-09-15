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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncRunsController = exports.SyncController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const errors_1 = require("../../common/errors/errors");
const list_sync_runs_query_dto_1 = require("./dto/list-sync-runs-query.dto");
const paginated_sync_runs_response_dto_1 = require("./dto/paginated-sync-runs-response.dto");
const sync_run_response_dto_1 = require("./dto/sync-run-response.dto");
const trigger_sync_response_dto_1 = require("./dto/trigger-sync-response.dto");
const sync_service_1 = require("./sync.service");
class TriggerSyncDto {
    customerId;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Customer to sync. Defaults to the configured default customer when omitted.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TriggerSyncDto.prototype, "customerId", void 0);
let SyncController = class SyncController {
    syncService;
    constructor(syncService) {
        this.syncService = syncService;
    }
    async syncUsers(body) {
        let run;
        try {
            run = await this.syncService.syncCustomer(body?.customerId);
        }
        catch (error) {
            if (error instanceof errors_1.SyncInProgressError) {
                throw new common_1.ConflictException(error.message);
            }
            throw error;
        }
        return {
            syncRunId: run.id,
            status: run.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            recordsFetched: run.recordsFetched ?? 0,
            recordsCreated: run.recordsCreated ?? 0,
            recordsUpdated: run.recordsUpdated ?? 0,
            recordsDeleted: run.recordsDeleted ?? 0,
            errorCode: run.errorCode,
            errorMessage: run.errorMessage,
        };
    }
};
exports.SyncController = SyncController;
__decorate([
    (0, common_1.Post)('users'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Synchronize users from the customer API',
        description: 'Safe to call repeatedly. Fetches the full external dataset, upserts changed/new users, ' +
            'and soft-deletes users that disappeared from the customer dataset. Returns 200 with a ' +
            'FAILED status (not an HTTP error) when the customer API is unreachable, so previously ' +
            'synchronized data is never touched.',
    }),
    (0, swagger_1.ApiBody)({ type: TriggerSyncDto, required: false }),
    (0, swagger_1.ApiOkResponse)({ type: trigger_sync_response_dto_1.TriggerSyncResponseDto }),
    (0, swagger_1.ApiConflictResponse)({
        description: 'A synchronization for this customer is already running.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TriggerSyncDto]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncUsers", null);
exports.SyncController = SyncController = __decorate([
    (0, swagger_1.ApiTags)('Sync'),
    (0, common_1.Controller)({ path: 'sync', version: common_1.VERSION_NEUTRAL }),
    __metadata("design:paramtypes", [sync_service_1.SyncService])
], SyncController);
let SyncRunsController = class SyncRunsController {
    syncService;
    constructor(syncService) {
        this.syncService = syncService;
    }
    async listRuns(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const customerId = await this.syncService.resolveCustomerId(query.customerId);
        const { data, total } = await this.syncService.listRuns(customerId, page, limit);
        return {
            data: data.map((run) => sync_run_response_dto_1.SyncRunResponseDto.fromEntity(run)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }
};
exports.SyncRunsController = SyncRunsController;
__decorate([
    (0, common_1.Get)('runs'),
    (0, swagger_1.ApiOperation)({
        summary: 'List past synchronization runs',
        description: 'Operational history: one row per POST /sync/users call, most recent first.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: paginated_sync_runs_response_dto_1.PaginatedSyncRunsResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_sync_runs_query_dto_1.ListSyncRunsQueryDto]),
    __metadata("design:returntype", Promise)
], SyncRunsController.prototype, "listRuns", null);
exports.SyncRunsController = SyncRunsController = __decorate([
    (0, swagger_1.ApiTags)('Sync'),
    (0, common_1.Controller)({ path: 'sync', version: '1' }),
    __metadata("design:paramtypes", [sync_service_1.SyncService])
], SyncRunsController);
//# sourceMappingURL=sync.controller.js.map