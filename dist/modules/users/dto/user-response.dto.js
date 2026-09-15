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
exports.UserResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class UserResponseDto {
    id;
    customerId;
    name;
    email;
    phone;
    status;
    company;
    companyIndustry;
    companyRole;
    isDeleted;
    sourceCreatedAt;
    sourceUpdatedAt;
    syncedAt;
    static fromEntity(user) {
        return {
            id: user.id,
            customerId: user.customerId,
            name: user.name,
            email: user.email,
            phone: user.phone,
            status: user.status,
            company: user.companyName,
            companyIndustry: user.companyIndustry,
            companyRole: user.companyRole,
            isDeleted: user.deletedAt !== null,
            sourceCreatedAt: user.externalCreatedAt,
            sourceUpdatedAt: user.externalUpdatedAt,
            syncedAt: user.updatedAt,
        };
    }
}
exports.UserResponseDto = UserResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Internal user id.' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Id of the customer this user belongs to.' }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "customerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserResponseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserResponseDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserResponseDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['active', 'invited', 'suspended'] }),
    __metadata("design:type", String)
], UserResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserResponseDto.prototype, "company", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserResponseDto.prototype, "companyIndustry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserResponseDto.prototype, "companyRole", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether this user is currently active in the customer dataset.',
    }),
    __metadata("design:type", Boolean)
], UserResponseDto.prototype, "isDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'When the customer created this record.' }),
    __metadata("design:type", Date)
], UserResponseDto.prototype, "sourceCreatedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'When the customer last updated this record.' }),
    __metadata("design:type", Date)
], UserResponseDto.prototype, "sourceUpdatedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'When our system last synchronized this record.',
    }),
    __metadata("design:type", Date)
], UserResponseDto.prototype, "syncedAt", void 0);
//# sourceMappingURL=user-response.dto.js.map