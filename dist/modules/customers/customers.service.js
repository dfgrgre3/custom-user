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
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_service_1 = require("../../infrastructure/database/supabase.service");
const types_1 = require("../../domain/types");
let CustomersService = class CustomersService {
    supabase;
    config;
    constructor(supabase, config) {
        this.supabase = supabase;
        this.config = config;
    }
    async getOrCreateDefaultCustomer() {
        const name = this.config.get('app.customer.name');
        const apiBaseUrl = this.config.get('app.customer.apiBaseUrl');
        const client = this.supabase.getClient();
        const { data: upserted, error } = await client
            .from('customers')
            .upsert({ name, api_base_url: apiBaseUrl }, { onConflict: 'name' })
            .select('*')
            .single();
        if (error || !upserted) {
            throw new Error(`Failed to upsert customer: ${error?.message}`);
        }
        return (0, types_1.mapCustomerRow)(upserted);
    }
    async findById(id) {
        const { data, error } = await this.supabase
            .getClient()
            .from('customers')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to look up customer: ${error.message}`);
        }
        return data ? (0, types_1.mapCustomerRow)(data) : null;
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        config_1.ConfigService])
], CustomersService);
//# sourceMappingURL=customers.service.js.map