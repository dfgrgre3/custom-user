import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { GetUserQueryDto } from './dto/get-user-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

/**
 * Every route here holds real customer PII (name, email, phone, company).
 * Requires a valid Supabase Auth bearer token for any signed-in user —
 * see decision on authentication in DESIGN.md.
 */
@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@UseGuards(SupabaseAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List synchronized users',
    description:
      'Reads from our own database only, never from the customer API directly. Always scoped to one customer (see customerId) — supports company filtering, search, status filtering, and pagination.',
  })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  async list(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    return this.usersService.list(query, query.customerId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one synchronized user by internal id',
    description:
      'Scoped to one customer (see customerId) — a user id belonging to a different customer returns 404, the same as an unknown id.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'No user with that id exists.' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetUserQueryDto,
  ): Promise<UserResponseDto> {
    return this.usersService.getById(id, query.customerId);
  }
}
