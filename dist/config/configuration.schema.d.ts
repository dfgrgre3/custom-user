import { z } from 'zod';
export declare const environmentSchema: z.ZodObject<{
    NODE_ENV: z.ZodOptional<z.ZodString>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    SUPABASE_URL: z.ZodString;
    SUPABASE_SERVICE_ROLE_KEY: z.ZodString;
    CUSTOMER_API_BASE_URL: z.ZodString;
    CUSTOMER_API_TOKEN: z.ZodString;
    CUSTOMER_NAME: z.ZodDefault<z.ZodString>;
    CUSTOMER_API_TIMEOUT_MS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    CUSTOMER_API_MAX_RETRIES: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    CUSTOMER_API_PAGE_SIZE: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    SYNC_CRON: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    FRONTEND_ORIGIN: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Environment = z.infer<typeof environmentSchema>;
export declare function validateEnvironment(env: Record<string, unknown>): Environment;
