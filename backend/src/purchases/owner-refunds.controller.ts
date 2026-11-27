import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CancelRefundsService } from './cancel-refunds.service';
import { SessionGuard, SessionUser } from '../auth/session.guard';
import { OwnerGuard } from '../common/guards/owner.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// The owner's «Повернення»: half refunds after a late cancellation, handed over in cash by the owner only
@Controller('owner/cancel-refunds')
@UseGuards(SessionGuard, OwnerGuard)
export class OwnerRefundsController {
  constructor(private readonly cancelRefunds: CancelRefundsService) {}

  @Get()
  pending() {
    return this.cancelRefunds.pendingForOwner();
  }

  @Post(':id/given')
  @HttpCode(HttpStatus.OK)
  given(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.cancelRefunds.ownerGive(user.id, id);
  }
}
