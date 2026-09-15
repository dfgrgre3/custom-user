import { registerAs } from '@nestjs/config';
import { environmentSchema } from './configuration.schema';

/**
 * Re-validates process.env here too (not just in ConfigModule's `validate`
 * hook) so this factory's own values are always the coerced/defaulted ones
 * — e.g. `PORT` as a number, not the raw string. `ConfigModule.forRoot`'s
 * `validate` option already runs this against the raw environment before
 * any factory executes and throws on failure, so by the time this function
 * runs the environment is known-good; this second parse is cheap and keeps
 * this file from silently drifting out of sync with the schema.
 */
export default registerAs('app', () => {
  const env = environmentSchema.parse(process.env);

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
