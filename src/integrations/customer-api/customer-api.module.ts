import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CustomerApiClient } from './customer-api.client';

@Module({
  imports: [HttpModule],
  providers: [CustomerApiClient],
  exports: [CustomerApiClient],
})
export class CustomerApiModule {}
