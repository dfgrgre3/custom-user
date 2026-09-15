"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.environmentSchema = void 0;
exports.validateEnvironment = validateEnvironment;
const cron_1 = require("cron");
const zod_1 = require("zod");
exports.environmentSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.string().optional(),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(3000),
    SUPABASE_URL: zod_1.z.string().url({
        message: 'SUPABASE_URL must be a valid URL (https://<ref>.supabase.co).',
    }),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z
        .string()
        .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required.'),
    CUSTOMER_API_BASE_URL: zod_1.z.string().url({
        message: 'CUSTOMER_API_BASE_URL must be a valid URL.',
    }),
    CUSTOMER_API_TOKEN: zod_1.z.string().min(1, 'CUSTOMER_API_TOKEN is required.'),
    CUSTOMER_NAME: zod_1.z.string().min(1).default('Assessment API'),
    CUSTOMER_API_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(10000),
    CUSTOMER_API_MAX_RETRIES: zod_1.z.coerce.number().int().min(0).default(3),
    CUSTOMER_API_PAGE_SIZE: zod_1.z.coerce.number().int().min(1).max(1000).default(100),
    SYNC_CRON: zod_1.z
        .string()
        .optional()
        .default('')
        .refine((value) => value === '' || (0, cron_1.validateCronExpression)(value).valid, 'SYNC_CRON must be a valid cron expression (or empty to disable scheduled sync).'),
    FRONTEND_ORIGIN: zod_1.z.string().url().optional(),
});
function validateEnvironment(env) {
    const result = exports.environmentSchema.safeParse(env);
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example for the required variables.`);
    }
    return result.data;
}
//# sourceMappingURL=configuration.schema.js.map