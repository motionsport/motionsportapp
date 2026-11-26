import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermanentDiscountsController } from './permanent-discounts.controller';
import { PermanentDiscountsService } from './permanent-discounts.service';

@Module({
  imports: [AuthModule],
  controllers: [PermanentDiscountsController],
  providers: [PermanentDiscountsService],
})
export class PermanentDiscountsModule {}
