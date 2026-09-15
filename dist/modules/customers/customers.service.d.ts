import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { Customer } from '../../domain/types';
export declare class CustomersService {
    private readonly supabase;
    private readonly config;
    constructor(supabase: SupabaseService, config: ConfigService);
    getOrCreateDefaultCustomer(): Promise<Customer>;
    findById(id: string): Promise<Customer | null>;
}
