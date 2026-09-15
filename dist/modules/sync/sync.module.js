"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const customers_module_1 = require("../customers/customers.module");
const customer_api_module_1 = require("../../integrations/customer-api/customer-api.module");
const sync_controller_1 = require("./sync.controller");
const sync_scheduler_1 = require("./sync.scheduler");
const sync_service_1 = require("./sync.service");
let SyncModule = class SyncModule {
};
exports.SyncModule = SyncModule;
exports.SyncModule = SyncModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot(), customer_api_module_1.CustomerApiModule, customers_module_1.CustomersModule],
        controllers: [sync_controller_1.SyncController, sync_controller_1.SyncRunsController],
        providers: [sync_service_1.SyncService, sync_scheduler_1.SyncScheduler],
        exports: [sync_service_1.SyncService],
    })
], SyncModule);
//# sourceMappingURL=sync.module.js.map