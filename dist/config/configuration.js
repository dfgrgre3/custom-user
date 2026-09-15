"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
const configuration_schema_1 = require("./configuration.schema");
exports.default = (0, config_1.registerAs)('app', () => {
    const env = configuration_schema_1.environmentSchema.parse(process.env);
    return {
        environment: env.NODE_ENV ?? 'development',
        port: env.PORT,
        supabase: {
            url: env.SUPABASE_URL,
            serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
        },
        frontendOrigin: env.FRONTEND_ORIGIN,
        customer: {
            name: env.CUSTOMER_NAME,
            apiBaseUrl: env.CUSTOMER_API_BASE_URL,
            apiToken: env.CUSTOMER_API_TOKEN,
            timeoutMs: env.CUSTOMER_API_TIMEOUT_MS,
            maxRetries: env.CUSTOMER_API_MAX_RETRIES,
            pageSize: env.CUSTOMER_API_PAGE_SIZE,
        },
        syncCron: env.SYNC_CRON,
    };
});
//# sourceMappingURL=configuration.js.map