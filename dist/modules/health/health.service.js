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
exports.HealthService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const supabase_service_1 = require("../../infrastructure/database/supabase.service");
let HealthService = class HealthService {
    supabase;
    http;
    config;
    constructor(supabase, http, config) {
        this.supabase = supabase;
        this.http = http;
        this.config = config;
    }
    async check() {
        const [database, customerApi] = await Promise.all([
            this.checkDatabase(),
            this.checkCustomerApi(),
        ]);
        return {
            status: database.status === 'ok' && customerApi.status === 'ok'
                ? 'ok'
                : 'error',
            components: { database, customerApi },
        };
    }
    async checkDatabase() {
        try {
            const { error } = await this.supabase
                .getClient()
                .from('customers')
                .select('id', { count: 'exact', head: true });
            if (error) {
                return { status: 'error', error: error.message };
            }
            return { status: 'ok' };
        }
        catch (error) {
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async checkCustomerApi() {
        const baseUrl = this.config.get('app.customer.apiBaseUrl');
        const token = this.config.get('app.customer.apiToken');
        try {
            await (0, rxjs_1.firstValueFrom)(this.http.get(`${baseUrl.replace(/\/+$/, '')}/api/users`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page: 1, limit: 1 },
                timeout: 5000,
            }));
            return { status: 'ok' };
        }
        catch (error) {
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        axios_1.HttpService,
        config_1.ConfigService])
], HealthService);
//# sourceMappingURL=health.service.js.map