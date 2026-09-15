"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SyncScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncScheduler = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const cron_1 = require("cron");
const sync_service_1 = require("./sync.service");
let SyncScheduler = SyncScheduler_1 = class SyncScheduler {
    syncService;
    config;
    schedulerRegistry;
    logger = new common_1.Logger(SyncScheduler_1.name);
    constructor(syncService, config, schedulerRegistry) {
        this.syncService = syncService;
        this.config = config;
        this.schedulerRegistry = schedulerRegistry;
    }
    onModuleInit() {
        const cronExpression = this.config.get('app.syncCron');
        if (!cronExpression) {
            this.logger.log('SYNC_CRON not set; scheduled synchronization is disabled.');
            return;
        }
        const job = new cron_1.CronJob(cronExpression, () => {
            this.logger.log('Running scheduled synchronization.');
            this.syncService
                .syncCustomer()
                .then((result) => {
                if (result.status === 'FAILED') {
                    this.logger.error(`Scheduled synchronization failed: ${result.errorCode} ${result.errorMessage}`);
                }
            })
                .catch((error) => {
                this.logger.error(`Scheduled synchronization failed: ${error.message}`);
            });
        });
        this.schedulerRegistry.addCronJob('customer-user-sync', job);
        job.start();
        this.logger.log(`Scheduled synchronization enabled with cron "${cronExpression}".`);
    }
};
exports.SyncScheduler = SyncScheduler;
exports.SyncScheduler = SyncScheduler = SyncScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sync_service_1.SyncService,
        config_1.ConfigService,
        schedule_1.SchedulerRegistry])
], SyncScheduler);
//# sourceMappingURL=sync.scheduler.js.map