import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Customer } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Owns customer identity. For this assessment there is one customer,
 * configured through environment variables, but callers (sync, users)
 * never assume that — they always go through a `Customer` row so that
 * adding a second customer later is a data change, not a code change.
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Returns the configured default customer, creating its row on first use. */
  async getOrCreateDefaultCustomer(): Promise<Customer> {
    const name = this.config.get<string>('app.customer.name')!;
    const apiBaseUrl = this.config.get<string>('app.customer.apiBaseUrl')!;

    const existing = await this.prisma.customer.findFirst({ where: { name } });
    if (existing) {
      if (existing.apiBaseUrl !== apiBaseUrl) {
        return this.prisma.customer.update({
          where: { id: existing.id },
          data: { apiBaseUrl },
        });
      }
      return existing;
    }

    this.logger.log(`Creating customer record for "${name}"`);
    return this.prisma.customer.create({ data: { name, apiBaseUrl } });
  }

  async findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { id } });
  }
}
