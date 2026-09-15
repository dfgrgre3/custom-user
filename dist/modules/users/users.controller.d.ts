import { GetUserQueryDto } from './dto/get-user-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    list(query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto>;
    getById(id: string, query: GetUserQueryDto): Promise<UserResponseDto>;
}
