import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CustomersModule } from '../customers/customers.module';
import { CustomerApiModule } from '../../integrations/customer-api/customer-api.module';
import { SyncController, SyncRunsController } from './sync.controller';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';

@Module({
  imports: [ScheduleModule.forRoot(), CustomerApiModule, CustomersModule],
  controllers: [SyncController, SyncRunsController],
  providers: [SyncService, SyncScheduler],
  exports: [SyncService],
})
export class SyncModule {}
