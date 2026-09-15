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
exports.TriggerSyncResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class TriggerSyncResponseDto {
    syncRunId;
    status;
    startedAt;
    completedAt;
    recordsFetched;
    recordsCreated;
    recordsUpdated;
    recordsDeleted;
    errorCode;
    errorMessage;
}
exports.TriggerSyncResponseDto = TriggerSyncResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TriggerSyncResponseDto.prototype, "syncRunId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['SUCCESS', 'FAILED'] }),
    __metadata("design:type", String)
], TriggerSyncResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], TriggerSyncResponseDto.prototype, "startedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], TriggerSyncResponseDto.prototype, "completedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TriggerSyncResponseDto.prototype, "recordsFetched", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TriggerSyncResponseDto.prototype, "recordsCreated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TriggerSyncResponseDto.prototype, "recordsUpdated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TriggerSyncResponseDto.prototype, "recordsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TriggerSyncResponseDto.prototype, "errorCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TriggerSyncResponseDto.prototype, "errorMessage", void 0);
//# sourceMappingURL=trigger-sync-response.dto.js.map