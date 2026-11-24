import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReviewDiscountsController } from './review-discounts.controller';
import { AdminReviewDiscountsController } from './admin-review-discounts.controller';
import { ReviewDiscountsService } from './review-discounts.service';

@Module({
  imports: [AuthModule],
  controllers: [ReviewDiscountsController, AdminReviewDiscountsController],
  providers: [ReviewDiscountsService],
  exports: [ReviewDiscountsService],
})
export class ReviewDiscountsModule {}
