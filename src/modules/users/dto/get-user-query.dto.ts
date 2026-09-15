import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GetUserQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Customer to scope this lookup to. Defaults to the configured default customer when omitted.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
