import { Module } from '@nestjs/common';
import { OwnerPricesController, PriceListController } from './prices.controller';
import { PricesService } from './prices.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OwnerPricesController, PriceListController],
  providers: [PricesService],
})
export class PricesModule {}
