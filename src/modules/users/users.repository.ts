import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

export interface FindUsersResult {
  data: User[];
  total: number;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: ListUsersQueryDto): Promise<FindUsersResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.UserWhereInput = {
      deletedAt: query.includeDeleted ? undefined : null,
    };

    if (query.company) {
      where.companyName = { contains: query.company, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status as User['status'];
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { externalUserId: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { companyIndustry: { contains: search, mode: 'insensitive' } },
        { companyRole: { contains: search, mode: 'insensitive' } },
        { companyWebsite: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
