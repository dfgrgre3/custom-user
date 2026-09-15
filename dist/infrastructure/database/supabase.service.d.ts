import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService implements OnModuleInit {
    private readonly config;
    private client;
    constructor(config: ConfigService);
    onModuleInit(): void;
    getClient(): SupabaseClient;
}
