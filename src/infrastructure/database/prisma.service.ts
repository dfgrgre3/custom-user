import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // Connection is intentionally deferred until a feature requires database access.
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
