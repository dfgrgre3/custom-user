import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SyncService } from './sync.service';

/**
 * Optional automated synchronization. Disabled unless SYNC_CRON is set,
 * since a fixed schedule is not part of the core requirement and shouldn't
 * run unexpectedly against someone's real customer API quota.
 *
 * Uses SchedulerRegistry's dynamic API rather than the static @Cron()
 * decorator because the schedule is only known at runtime, from config.
 *
 * `addCronJob`'s parameter type comes from `@nestjs/schedule`'s own nested
 * `cron` dependency, which can differ structurally (but not behaviorally)
 * from the top-level `cron` package used here; the cast reflects that this
 * is a real, runtime-compatible CronJob rather than a workaround.
 */
@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const cronExpression = this.config.get<string>('app.syncCron');
    if (!cronExpression) {
      this.logger.log(
        'SYNC_CRON not set; scheduled synchronization is disabled.',
      );
      return;
    }

    const job = new CronJob(cronExpression, () => {
      this.logger.log('Running scheduled synchronization.');
      this.syncService.syncCustomer().catch((error) => {
        this.logger.error(
          `Scheduled synchronization failed: ${(error as Error).message}`,
        );
      });
    });

    this.schedulerRegistry.addCronJob(
      'customer-user-sync',
      job as Parameters<SchedulerRegistry['addCronJob']>[1],
    );
    job.start();
    this.logger.log(
      `Scheduled synchronization enabled with cron "${cronExpression}".`,
    );
  }
}
