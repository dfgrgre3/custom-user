import { UserResponseDto } from './user-response.dto';
export declare class PaginationMetaDto {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export declare class PaginatedUsersResponseDto {
    data: UserResponseDto[];
    pagination: PaginationMetaDto;
}
