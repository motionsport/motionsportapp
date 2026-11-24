import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ReviewDiscountsService } from './review-discounts.service';
import { SessionGuard } from '../auth/session.guard';
import { MemberGuard } from '../common/guards/member.guard';
import { CurrentMember } from '../auth/current-user.decorator';
import type { UserOf } from '../auth/roles';

@Controller('review-discount')
@UseGuards(SessionGuard, MemberGuard)
export class ReviewDiscountsController {
  constructor(private readonly service: ReviewDiscountsService) {}

  @Get()
  mine(@CurrentMember() user: UserOf<'member'>) {
    return this.service.mine(user.id);
  }

  @Post('bar')
  @HttpCode(200)
  useAtBar(@CurrentMember() user: UserOf<'member'>) {
    return this.service.useAtBar(user.id);
  }
}
