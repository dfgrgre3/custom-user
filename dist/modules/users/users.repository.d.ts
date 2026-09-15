import { SupabaseService } from '../../infrastructure/database/supabase.service';
import { User } from '../../domain/types';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
export interface FindUsersResult {
    data: User[];
    total: number;
}
export declare class UsersRepository {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    findMany(customerId: string, query: ListUsersQueryDto): Promise<FindUsersResult>;
    findById(customerId: string, id: string): Promise<User | null>;
}
