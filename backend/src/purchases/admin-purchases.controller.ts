import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { AdminPurchasesService } from './admin-purchases.service';
import { CancelRefundsService } from './cancel-refunds.service';
import { SessionGuard, SessionUser } from '../auth/session.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AddClubCardDto } from './dto/add-club-card.dto';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminPurchasesController {
  constructor(
    private readonly adminPurchasesService: AdminPurchasesService,
    private readonly cancelRefunds: CancelRefundsService,
  ) {}

  @Get('purchases/pending')
  pendingCash(@CurrentUser() user: SessionUser) {
    return this.adminPurchasesService.pendingCash(user.id);
  }

  @Get('payments/stray')
  strayPayments(@CurrentUser() user: SessionUser) {
    return this.adminPurchasesService.strayPayments(user.id);
  }

  @Post('payments/:id/handled')
  @HttpCode(200)
  markPaymentHandled(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.adminPurchasesService.markPaymentHandled(user.id, id);
  }

  // «Повернути гроші»: the training's trainer only
  @Get('cancel-refunds/pending')
  pendingCancelRefunds(@CurrentUser() user: SessionUser) {
    return this.cancelRefunds.pending(user.id);
  }

  @Post('cancel-refunds/:id/refund')
  @HttpCode(200)
  refundCancelRefund(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.cancelRefunds.refund(user.id, id);
  }

  @Post('cancel-refunds/:id/check')
  @HttpCode(200)
  checkCancelRefund(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.cancelRefunds.check(user.id, id);
  }

  @Post('cancel-refunds/:id/done')
  @HttpCode(200)
  markCancelRefundDone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.cancelRefunds.markDone(user.id, id);
  }

  @Post('purchases/:id/confirm')
  @HttpCode(200)
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.adminPurchasesService.confirmCash(user.id, id);
  }

  @Post('purchases/:id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.adminPurchasesService.rejectCash(user.id, id);
  }

  @Get('members/:memberId/purchases')
  memberPurchases(@Param('memberId', ParseUUIDPipe) memberId: string, @CurrentUser() user: SessionUser) {
    return this.adminPurchasesService.memberPurchases(user.id, memberId);
  }

  @Post('members/:memberId/club-card')
  @HttpCode(200)
  addCard(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: AddClubCardDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.adminPurchasesService.addCard(user.id, memberId, dto.priceItemId, dto.activate ?? false);
  }

  @Post('members/:memberId/club-cards/:cardId/activate')
  @HttpCode(200)
  activateCard(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.adminPurchasesService.activateCard(user.id, memberId, cardId);
  }
}
