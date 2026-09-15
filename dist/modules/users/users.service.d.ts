import { CustomersService } from '../customers/customers.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersRepository } from './users.repository';
export declare class UsersService {
    private readonly usersRepository;
    private readonly customersService;
    constructor(usersRepository: UsersRepository, customersService: CustomersService);
    private resolveCustomerId;
    list(query: ListUsersQueryDto, customerId?: string): Promise<PaginatedUsersResponseDto>;
    getById(id: string, customerId?: string): Promise<UserResponseDto>;
}
