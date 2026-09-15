import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncRun, SyncRunStatus } from '@prisma/client';
import { SyncInProgressError } from '../../common/errors/errors';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CustomerApiClient } from '../../integrations/customer-api/customer-api.client';
import { CustomerApiError } from '../../integrations/customer-api/customer-api.errors';
import { mapExternalUserToSyncedUserData } from '../../integrations/customer-api/customer-api.mapper';
import { CustomersService } from '../customers/customers.service';

/**
 * Orchestrates one synchronization run for one customer:
 *
 *   1. Fetch the *complete* external dataset (all pages) before touching
 *      the database — a failure here leaves previously synced data intact.
 *   2. Map every external user into our internal representation.
 *   3. In a single transaction: upsert every fetched user (by
 *      (customerId, externalUserId)), then soft-delete any previously
 *      synced, still-active user that was NOT in this fetch, then record
 *      the SyncRun outcome.
 *
 * Running the same fetch twice is a no-op: unchanged users are simply
 * re-written with the same values, and already-deleted users stay deleted.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  /** Process-local guard against overlapping runs for the same customer. */
  private readonly runningCustomers = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerApiClient: CustomerApiClient,
    private readonly customersService: CustomersService,
    private readonly config: ConfigService,
  ) {}

  async syncCustomer(customerId?: string): Promise<SyncRun> {
    const customer = customerId
      ? await this.customersService.findById(customerId)
      : await this.customersService.getOrCreateDefaultCustomer();

    if (!customer) {
      throw new Error(`Unknown customer: ${customerId}`);
    }

    if (this.runningCustomers.has(customer.id)) {
      throw new SyncInProgressError(customer.id);
    }
    this.runningCustomers.add(customer.id);

    const syncRun = await this.prisma.syncRun.create({
      data: { customerId: customer.id, status: SyncRunStatus.RUNNING },
    });

    try {
      const token = this.config.get<string>('app.customer.apiToken')!;
      const externalUsers = await this.customerApiClient.fetchAllUsers({
        baseUrl: customer.apiBaseUrl,
        token,
        timeoutMs: this.config.get<number>('app.customer.timeoutMs')!,
        maxRetries: this.config.get<number>('app.customer.maxRetries')!,
        pageSize: this.config.get<number>('app.customer.pageSize')!,
      });

      const fetchedExternalIds = new Set(externalUsers.map((u) => u.id));

      const result = await this.prisma.$transaction(async (tx) => {
        const existingIds = new Set(
          (
            await tx.user.findMany({
              where: { customerId: customer.id },
              select: { externalUserId: true },
            })
          ).map((u) => u.externalUserId),
        );

        let created = 0;
        let updated = 0;

        for (const externalUser of externalUsers) {
          const data = mapExternalUserToSyncedUserData(externalUser);
          await tx.user.upsert({
            where: {
              customerId_externalUserId: {
                customerId: customer.id,
                externalUserId: data.externalUserId,
              },
            },
            create: { customerId: customer.id, ...data },
            update: { ...data, deletedAt: null },
          });
          if (existingIds.has(data.externalUserId)) {
            updated += 1;
          } else {
            created += 1;
          }
        }

        // Anything previously active but absent from this fetch is gone
        // from the customer's dataset: mark it deleted, don't remove it.
        const stillActive = await tx.user.findMany({
          where: { customerId: customer.id, deletedAt: null },
          select: { id: true, externalUserId: true },
        });
        const missingIds = stillActive
          .filter((u) => !fetchedExternalIds.has(u.externalUserId))
          .map((u) => u.id);

        let deleted = 0;
        if (missingIds.length > 0) {
          const result = await tx.user.updateMany({
            where: { id: { in: missingIds } },
            data: { deletedAt: new Date() },
          });
          deleted = result.count;
        }

        return {
          fetched: externalUsers.length,
          created,
          updated,
          deleted,
        };
      });

      const completed = await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: SyncRunStatus.SUCCESS,
          completedAt: new Date(),
          recordsFetched: result.fetched,
          recordsCreated: result.created,
          recordsUpdated: result.updated,
          recordsDeleted: result.deleted,
        },
      });

      this.logger.log(
        `sync.completed customerId=${customer.id} fetched=${result.fetched} created=${result.created} updated=${result.updated} deleted=${result.deleted}`,
      );
      return completed;
    } catch (error) {
      const { code, message } = this.classifyError(error);
      this.logger.error(
        `sync.failed customerId=${customer.id} code=${code} message=${message}`,
      );

      return this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: SyncRunStatus.FAILED,
          completedAt: new Date(),
          errorCode: code,
          errorMessage: message,
        },
      });
    } finally {
      this.runningCustomers.delete(customer.id);
    }
  }

  async listRuns(
    page: number,
    limit: number,
  ): Promise<{ data: SyncRun[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.syncRun.findMany({
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.syncRun.count(),
    ]);
    return { data, total };
  }

  private classifyError(error: unknown): { code: string; message: string } {
    if (error instanceof CustomerApiError) {
      return {
        code:
          error.name === 'CustomerApiUnauthorizedError'
            ? 'EXTERNAL_API_UNAUTHORIZED'
            : 'EXTERNAL_API',
        message: error.message,
      };
    }
    if (error instanceof Error) {
      return { code: 'UNEXPECTED', message: error.message };
    }
    return {
      code: 'UNEXPECTED',
      message: 'Unknown error during synchronization.',
    };
  }
}
