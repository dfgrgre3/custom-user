import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TriggerSyncResponseDto {
  @ApiProperty() syncRunId!: string;
  @ApiProperty({ enum: ['SUCCESS', 'FAILED'] }) status!: 'SUCCESS' | 'FAILED';
  @ApiProperty() startedAt!: Date;
  @ApiProperty() completedAt!: Date;
  @ApiProperty() recordsFetched!: number;
  @ApiProperty() recordsCreated!: number;
  @ApiProperty() recordsUpdated!: number;
  @ApiProperty() recordsDeleted!: number;
  @ApiPropertyOptional({ nullable: true }) errorCode?: string | null;
  @ApiPropertyOptional({ nullable: true }) errorMessage?: string | null;
}
