import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { CustomerApiClient } from '../../integrations/customer-api/customer-api.client';
import { CustomersService } from '../customers/customers.service';
import { SyncRun } from '../../domain/types';
export declare class SyncService {
    private readonly supabase;
    private readonly customerApiClient;
    private readonly customersService;
    private readonly config;
    private readonly logger;
    constructor(supabase: SupabaseService, customerApiClient: CustomerApiClient, customersService: CustomersService, config: ConfigService);
    syncCustomer(customerId?: string): Promise<SyncRun>;
    listRuns(customerId: string, page: number, limit: number): Promise<{
        data: SyncRun[];
        total: number;
    }>;
    resolveCustomerId(customerId?: string): Promise<string>;
    private classifyError;
}
