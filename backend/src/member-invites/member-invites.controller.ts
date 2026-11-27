import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { MemberInvitesService } from './member-invites.service';
import { SessionGuard, SessionUser } from '../auth/session.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateMemberInviteDto } from './dto/create-member-invite.dto';

// «Запросити нового клієнта»: own invites only
@Controller('admin/member-invites')
@UseGuards(SessionGuard, AdminGuard)
export class MemberInvitesController {
  constructor(private readonly service: MemberInvitesService) {}

  @Post()
  create(@Body() dto: CreateMemberInviteDto, @CurrentUser() user: SessionUser) {
    return this.service.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.service.listActive(user.id);
  }

  @Post(':id/link')
  @HttpCode(200)
  relink(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.service.relink(user.id, id);
  }

  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.service.revoke(user.id, id);
  }
}
