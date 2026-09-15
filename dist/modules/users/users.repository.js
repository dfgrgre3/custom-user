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
exports.UsersRepository = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infrastructure/database/supabase.service");
const types_1 = require("../../domain/types");
function escapePostgrestFilterValue(value) {
    return value.replace(/[,.()\\]/g, (char) => `\\${char}`);
}
let UsersRepository = class UsersRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async findMany(customerId, query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        let builder = this.supabase
            .getClient()
            .from('users')
            .select('*', { count: 'exact' })
            .eq('customer_id', customerId);
        builder = query.includeDeleted ? builder : builder.is('deleted_at', null);
        if (query.company) {
            builder = builder.ilike('company_name', `%${query.company}%`);
        }
        if (query.status) {
            builder = builder.eq('status', query.status);
        }
        const search = query.search?.trim();
        if (search) {
            const pattern = `%${escapePostgrestFilterValue(search)}%`;
            builder = builder.or([
                `name.ilike.${pattern}`,
                `email.ilike.${pattern}`,
                `external_user_id.ilike.${pattern}`,
                `company_name.ilike.${pattern}`,
                `company_industry.ilike.${pattern}`,
                `company_role.ilike.${pattern}`,
                `company_website.ilike.${pattern}`,
            ].join(','));
        }
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const { data, count, error } = await builder
            .order('updated_at', { ascending: false })
            .range(from, to);
        if (error) {
            throw new Error(`Failed to list users: ${error.message}`);
        }
        return {
            data: (data ?? []).map(types_1.mapUserRow),
            total: count ?? 0,
        };
    }
    async findById(customerId, id) {
        const { data, error } = await this.supabase
            .getClient()
            .from('users')
            .select('*')
            .eq('id', id)
            .eq('customer_id', customerId)
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to look up user: ${error.message}`);
        }
        return data ? (0, types_1.mapUserRow)(data) : null;
    }
};
exports.UsersRepository = UsersRepository;
exports.UsersRepository = UsersRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], UsersRepository);
//# sourceMappingURL=users.repository.js.map