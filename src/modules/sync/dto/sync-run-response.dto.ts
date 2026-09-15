import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SyncRun } from '@prisma/client';

export class SyncRunResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty({ enum: ['RUNNING', 'SUCCESS', 'FAILED'] }) status!: string;
  @ApiProperty() startedAt!: Date;
  @ApiPropertyOptional({ nullable: true }) completedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) durationMs!: number | null;
  @ApiPropertyOptional({ nullable: true }) recordsFetched!: number | null;
  @ApiPropertyOptional({ nullable: true }) recordsCreated!: number | null;
  @ApiPropertyOptional({ nullable: true }) recordsUpdated!: number | null;
  @ApiPropertyOptional({ nullable: true }) recordsDeleted!: number | null;
  @ApiPropertyOptional({ nullable: true }) errorCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) errorMessage!: string | null;

  static fromEntity(run: SyncRun): SyncRunResponseDto {
    return {
      id: run.id,
      customerId: run.customerId,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.completedAt
        ? run.completedAt.getTime() - run.startedAt.getTime()
        : null,
      recordsFetched: run.recordsFetched,
      recordsCreated: run.recordsCreated,
      recordsUpdated: run.recordsUpdated,
      recordsDeleted: run.recordsDeleted,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
    };
  }
}
