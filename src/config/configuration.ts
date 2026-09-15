import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',

  customer: {
    name: process.env.CUSTOMER_NAME ?? 'Assessment API',
    apiBaseUrl: process.env.CUSTOMER_API_BASE_URL ?? '',
    apiToken: process.env.CUSTOMER_API_TOKEN ?? '',
    timeoutMs: Number.parseInt(
      process.env.CUSTOMER_API_TIMEOUT_MS ?? '10000',
      10,
    ),
    maxRetries: Number.parseInt(
      process.env.CUSTOMER_API_MAX_RETRIES ?? '3',
      10,
    ),
    pageSize: Number.parseInt(process.env.CUSTOMER_API_PAGE_SIZE ?? '100', 10),
  },

  syncCron: process.env.SYNC_CRON ?? '',
}));
