"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nestjs_pino_1 = require("nestjs-pino");
const customers_module_1 = require("./modules/customers/customers.module");
const sync_module_1 = require("./modules/sync/sync.module");
const users_module_1 = require("./modules/users/users.module");
const configuration_1 = require("./config/configuration");
const configuration_schema_1 = require("./config/configuration.schema");
const database_module_1 = require("./infrastructure/database/database.module");
const health_module_1 = require("./modules/health/health.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.default],
                validate: configuration_schema_1.validateEnvironment,
            }),
            nestjs_pino_1.LoggerModule.forRoot({
                pinoHttp: {
                    transport: process.env.NODE_ENV === 'production'
                        ? undefined
                        : { target: 'pino-pretty', options: { singleLine: true } },
                    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                    redact: {
                        paths: ['req.headers.authorization', 'req.headers.cookie'],
                        censor: '[REDACTED]',
                    },
                    autoLogging: true,
                },
            }),
            database_module_1.DatabaseModule,
            users_module_1.UsersModule,
            sync_module_1.SyncModule,
            customers_module_1.CustomersModule,
            health_module_1.HealthModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map