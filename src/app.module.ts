import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { CustomersModule } from './modules/customers/customers.module';
import { SyncModule } from './modules/sync/sync.module';
import { UsersModule } from './modules/users/users.module';
import configuration from './config/configuration';
import { validateEnvironment } from './config/configuration.schema';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Fails application startup immediately, with every problem listed at
      // once, if required env vars are missing/invalid — rather than
      // starting "successfully" and only failing on the first request that
      // touches Supabase or the customer API.
      validate: validateEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Structured (JSON) logs in production, so they're indexable by
        // log aggregation tools; human-readable colored output in
        // development, since nobody wants to eyeball raw JSON locally.
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["x-admin-token"]',
            'req.headers.cookie',
          ],
          censor: '[REDACTED]',
        },
        autoLogging: true,
      },
    }),
    DatabaseModule,
    UsersModule,
    SyncModule,
    CustomersModule,
    HealthModule,
  ],
})
export class AppModule {}
