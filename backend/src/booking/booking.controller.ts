import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentMember } from '../auth/current-user.decorator';
import type { UserOf } from '../auth/roles';
import { MemberGuard } from '../common/guards/member.guard';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { SwitchBookingDto } from './dto/switch-booking.dto';
import { AddGuestDto } from './dto/add-guest.dto';

@Controller('bookings')
// Members only: the guard answers 403 to a trainer or the owner
@UseGuards(SessionGuard, MemberGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async book(@CurrentMember() user: UserOf<'member'>, @Body() dto: CreateBookingDto) {
    return this.bookingService.book(user.id, dto.slotId);
  }

  // Late-cancellation warning shown before the member confirms
  @Get('cancel-fee')
  async cancelFee(@CurrentMember() user: UserOf<'member'>, @Query('slotId', ParseUUIDPipe) slotId: string) {
    return this.bookingService.cancelFeePreview(user.id, slotId);
  }

  @Delete('current')
  @HttpCode(HttpStatus.OK)
  async cancelCurrent(@CurrentMember() user: UserOf<'member'>, @Body() dto: CancelBookingDto) {
    return this.bookingService.cancel(user.id, dto.slotId, dto.reason);
  }

  @Patch('current')
  @HttpCode(HttpStatus.OK)
  async switchSlot(@CurrentMember() user: UserOf<'member'>, @Body() dto: SwitchBookingDto) {
    return this.bookingService.switchSlot(user.id, dto.newSlotId, dto.reason);
  }

  @Post('guest')
  @HttpCode(HttpStatus.OK)
  async addGuest(@CurrentMember() user: UserOf<'member'>, @Body() dto: AddGuestDto) {
    return this.bookingService.addGuest(user.id, dto.slotId, dto.name);
  }

  @Delete('guest')
  @HttpCode(HttpStatus.OK)
  async removeGuest(@CurrentMember() user: UserOf<'member'>, @Body() dto: CreateBookingDto) {
    return this.bookingService.removeGuest(user.id, dto.slotId);
  }
}
