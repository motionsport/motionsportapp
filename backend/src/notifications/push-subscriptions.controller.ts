import { Controller, Post, Delete, Get, Body, UseGuards, HttpCode } from '@nestjs/common';
import { SessionGuard, SessionUser } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { byRole } from '../auth/roles';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { UpsertPushSubscriptionDto, DeletePushSubscriptionDto } from './dto/upsert-push-subscription.dto';

@Controller('push')
export class PushSubscriptionsController {
  constructor(private readonly svc: PushSubscriptionsService) {}

  @Get('vapid-public-key')
  getVapidKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? '' };
  }

  @Post('subscriptions')
  @UseGuards(SessionGuard)
  @HttpCode(200)
  async subscribe(@Body() dto: UpsertPushSubscriptionDto, @CurrentUser() user: SessionUser) {
    await byRole(user, {
      member: (u) => this.svc.upsert(u.id, dto.endpoint, dto.p256dh, dto.auth),
      admin: (u) => this.svc.upsertAdmin(u.id, dto.endpoint, dto.p256dh, dto.auth),
      owner: () => undefined, // the owner gets no pushes: nothing to store
    });
    return { ok: true };
  }

  @Delete('subscriptions')
  @UseGuards(SessionGuard)
  @HttpCode(200)
  async unsubscribe(@Body() dto: DeletePushSubscriptionDto, @CurrentUser() user: SessionUser) {
    await byRole(user, {
      member: (u) => this.svc.remove(u.id, dto.endpoint),
      admin: (u) => this.svc.removeAdmin(u.id, dto.endpoint),
      owner: () => undefined,
    });
    return { ok: true };
  }
}
