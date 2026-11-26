import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { OwnerMembersService } from './owner-members.service';
import { SessionGuard, SessionUser } from '../auth/session.guard';
import { OwnerGuard } from '../common/guards/owner.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// The owner's «Клієнти»: search, «Вимкнути» / «Увімкнути»
@Controller('owner/members')
@UseGuards(SessionGuard, OwnerGuard)
export class OwnerMembersController {
  constructor(private readonly service: OwnerMembersService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.service.list(typeof q === 'string' ? q.slice(0, 60) : '');
  }

  @Post(':memberId/disable')
  @HttpCode(HttpStatus.OK)
  disable(@Param('memberId', ParseUUIDPipe) memberId: string, @CurrentUser() user: SessionUser) {
    return this.service.disable(user.id, memberId);
  }

  @Post(':memberId/enable')
  @HttpCode(HttpStatus.OK)
  enable(@Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.service.enable(memberId);
  }
}
