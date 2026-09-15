import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
export type ComponentStatus = 'ok' | 'error';
export interface HealthCheckResult {
    status: ComponentStatus;
    components: {
        database: {
            status: ComponentStatus;
            error?: string;
        };
        customerApi: {
            status: ComponentStatus;
            error?: string;
        };
    };
}
export declare class HealthService {
    private readonly supabase;
    private readonly http;
    private readonly config;
    constructor(supabase: SupabaseService, http: HttpService, config: ConfigService);
    check(): Promise<HealthCheckResult>;
    private checkDatabase;
    private checkCustomerApi;
}
