import { validateCronExpression } from 'cron';
import { z } from 'zod';

/**
 * Validates process.env at startup so a misconfigured deployment fails
 * immediately with a clear message, instead of starting "successfully"
 * and then failing on the first request that touches Supabase or the
 * customer API (or worse, running with silently-wrong tuning values like
 * a negative retry count or a zero page size).
 */
export const environmentSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  SUPABASE_URL: z.string().url({
    message: 'SUPABASE_URL must be a valid URL (https://<ref>.supabase.co).',
  }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required.'),

  CUSTOMER_API_BASE_URL: z.string().url({
    message: 'CUSTOMER_API_BASE_URL must be a valid URL.',
  }),
  CUSTOMER_API_TOKEN: z.string().min(1, 'CUSTOMER_API_TOKEN is required.'),
  CUSTOMER_NAME: z.string().min(1).default('Assessment API'),

  CUSTOMER_API_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  CUSTOMER_API_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  CUSTOMER_API_PAGE_SIZE: z.coerce.number().int().min(1).max(1000).default(100),

  SYNC_CRON: z
    .string()
    .optional()
    .default('')
    .refine(
      (value) => value === '' || validateCronExpression(value).valid,
      'SYNC_CRON must be a valid cron expression (or empty to disable scheduled sync).',
    ),

  FRONTEND_ORIGIN: z.string().url().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

/** Throws with a readable, multi-line message listing every problem at once. */
export function validateEnvironment(env: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nSee .env.example for the required variables.`,
    );
  }
  return result.data;
}
