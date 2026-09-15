import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly customersService: CustomersService,
  ) {}

  /**
   * Resolves the acting customer: an explicit `customerId` (an admin
   * inspecting a specific customer) or the configured default customer.
   * Every read in this service goes through this — see UsersRepository's
   * `findMany`/`findById` for why an explicit customer scope matters.
   */
  private async resolveCustomerId(customerId?: string): Promise<string> {
    if (customerId) return customerId;
    const customer = await this.customersService.getOrCreateDefaultCustomer();
    return customer.id;
  }

  async list(
    query: ListUsersQueryDto,
    customerId?: string,
  ): Promise<PaginatedUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const resolvedCustomerId = await this.resolveCustomerId(customerId);

    const { data, total } = await this.usersRepository.findMany(
      resolvedCustomerId,
      query,
    );

    return {
      data: data.map((user) => UserResponseDto.fromEntity(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getById(id: string, customerId?: string): Promise<UserResponseDto> {
    const resolvedCustomerId = await this.resolveCustomerId(customerId);
    const user = await this.usersRepository.findById(resolvedCustomerId, id);
    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }
    return UserResponseDto.fromEntity(user);
  }
}
