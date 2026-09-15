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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncRunResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class SyncRunResponseDto {
    id;
    customerId;
    status;
    startedAt;
    completedAt;
    durationMs;
    recordsFetched;
    recordsCreated;
    recordsUpdated;
    recordsDeleted;
    errorCode;
    errorMessage;
    static fromEntity(run) {
        return {
            id: run.id,
            customerId: run.customerId,
            status: run.status,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            durationMs: run.completedAt
                ? run.completedAt.getTime() - run.startedAt.getTime()
                : null,
            recordsFetched: run.recordsFetched,
            recordsCreated: run.recordsCreated,
            recordsUpdated: run.recordsUpdated,
            recordsDeleted: run.recordsDeleted,
            errorCode: run.errorCode,
            errorMessage: run.errorMessage,
        };
    }
}
exports.SyncRunResponseDto = SyncRunResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SyncRunResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SyncRunResponseDto.prototype, "customerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['RUNNING', 'SUCCESS', 'FAILED'] }),
    __metadata("design:type", String)
], SyncRunResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], SyncRunResponseDto.prototype, "startedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SyncRunResponseDto.prototype, "completedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SyncRunResponseDto.prototype, "durationMs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SyncRunResponseDto.prototype, "recordsFetched", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SyncRunResponseDto.prototype, "recordsCreated", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SyncRunResponseDto.prototype, "recordsUpdated", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SyncRunResponseDto.prototype, "recordsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SyncRunResponseDto.prototype, "errorCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SyncRunResponseDto.prototype, "errorMessage", void 0);
//# sourceMappingURL=sync-run-response.dto.js.map