import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { PermanentDiscountsService } from './permanent-discounts.service';
import { SessionGuard, SessionUser } from '../auth/session.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SetPermanentDiscountDto } from './dto/set-permanent-discount.dto';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class PermanentDiscountsController {
  constructor(private readonly service: PermanentDiscountsService) {}

  @Put('members/:memberId/permanent-discount')
  setKind(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SetPermanentDiscountDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.setKind(user.id, memberId, dto.kind ?? null);
  }

  @Post('members/:memberId/birthday-discount')
  @HttpCode(200)
  giveBirthday(@Param('memberId', ParseUUIDPipe) memberId: string, @CurrentUser() user: SessionUser) {
    return this.service.giveBirthday(user.id, memberId);
  }
}
