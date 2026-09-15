import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '@prisma/client';

/**
 * Public shape returned by our API. Deliberately independent of both the
 * Prisma model and the customer API's response — internal id, our own
 * timestamp names, and a flattened but renamed company block.
 */
export class UserResponseDto {
  @ApiProperty({ description: 'Internal user id.' })
  id!: string;

  @ApiProperty({ description: 'Id of the customer this user belongs to.' })
  customerId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: ['active', 'invited', 'suspended'] })
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  company!: string | null;

  @ApiPropertyOptional({ nullable: true })
  companyIndustry!: string | null;

  @ApiPropertyOptional({ nullable: true })
  companyRole!: string | null;

  @ApiProperty({
    description:
      'Whether this user is currently active in the customer dataset.',
  })
  isDeleted!: boolean;

  @ApiProperty({ description: 'When the customer created this record.' })
  sourceCreatedAt!: Date;

  @ApiProperty({ description: 'When the customer last updated this record.' })
  sourceUpdatedAt!: Date;

  @ApiProperty({
    description: 'When our system last synchronized this record.',
  })
  syncedAt!: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      customerId: user.customerId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      company: user.companyName,
      companyIndustry: user.companyIndustry,
      companyRole: user.companyRole,
      isDeleted: user.deletedAt !== null,
      sourceCreatedAt: user.externalCreatedAt,
      sourceUpdatedAt: user.externalUpdatedAt,
      syncedAt: user.updatedAt,
    };
  }
}
