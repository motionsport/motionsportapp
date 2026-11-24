import { Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ReviewDiscountsService } from './review-discounts.service';
import { SessionGuard, SessionUser } from '../auth/session.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminReviewDiscountsController {
  constructor(private readonly service: ReviewDiscountsService) {}

  @Post('members/:memberId/review-discount')
  @HttpCode(200)
  give(@Param('memberId', ParseUUIDPipe) memberId: string, @CurrentUser() user: SessionUser) {
    return this.service.give(user.id, memberId);
  }
}
