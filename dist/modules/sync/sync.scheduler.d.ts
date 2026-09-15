import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SyncService } from './sync.service';
export declare class SyncScheduler implements OnModuleInit {
    private readonly syncService;
    private readonly config;
    private readonly schedulerRegistry;
    private readonly logger;
    constructor(syncService: SyncService, config: ConfigService, schedulerRegistry: SchedulerRegistry);
    onModuleInit(): void;
}
