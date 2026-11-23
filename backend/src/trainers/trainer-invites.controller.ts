import { Controller, Get, Post, Delete, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { TrainerInvitesService } from './trainer-invites.service';
import { SessionGuard } from '../auth/session.guard';
import { OwnerGuard } from '../common/guards/owner.guard';

// Only the owner invites trainers (since 2026-11-23)
@Controller('owner/trainer-invites')
@UseGuards(SessionGuard, OwnerGuard)
export class TrainerInvitesController {
  constructor(private readonly invites: TrainerInvitesService) {}

  @Post()
  create() {
    return this.invites.create();
  }

  @Get()
  list() {
    return this.invites.listActive();
  }

  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.invites.revoke(id);
  }
}
