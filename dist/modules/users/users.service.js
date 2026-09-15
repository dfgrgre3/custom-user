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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const customers_service_1 = require("../customers/customers.service");
const user_response_dto_1 = require("./dto/user-response.dto");
const users_repository_1 = require("./users.repository");
let UsersService = class UsersService {
    usersRepository;
    customersService;
    constructor(usersRepository, customersService) {
        this.usersRepository = usersRepository;
        this.customersService = customersService;
    }
    async resolveCustomerId(customerId) {
        if (customerId)
            return customerId;
        const customer = await this.customersService.getOrCreateDefaultCustomer();
        return customer.id;
    }
    async list(query, customerId) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const resolvedCustomerId = await this.resolveCustomerId(customerId);
        const { data, total } = await this.usersRepository.findMany(resolvedCustomerId, query);
        return {
            data: data.map((user) => user_response_dto_1.UserResponseDto.fromEntity(user)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }
    async getById(id, customerId) {
        const resolvedCustomerId = await this.resolveCustomerId(customerId);
        const user = await this.usersRepository.findById(resolvedCustomerId, id);
        if (!user) {
            throw new common_1.NotFoundException(`User ${id} was not found.`);
        }
        return user_response_dto_1.UserResponseDto.fromEntity(user);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_repository_1.UsersRepository,
        customers_service_1.CustomersService])
], UsersService);
//# sourceMappingURL=users.service.js.map