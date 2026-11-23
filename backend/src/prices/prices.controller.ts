import { Controller, Get, Patch, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { PricesService } from './prices.service';
import { SessionGuard, SessionUser } from '../auth/session.guard';
import { OwnerGuard } from '../common/guards/owner.guard';
import { MemberOrAdminGuard } from '../common/guards/member-or-admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdatePriceDto } from './dto/update-price.dto';

// Only the owner changes prices (since 2026-11-23); the list comes with the change history
@Controller('owner/prices')
@UseGuards(SessionGuard, OwnerGuard)
export class OwnerPricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  getPrices() {
    return this.pricesService.getPrices();
  }

  @Patch(':id')
  updatePrice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePriceDto, @CurrentUser() user: SessionUser) {
    return this.pricesService.updatePrice(user.id, id, dto);
  }
}

// Members and trainers: amounts only, read-only
@Controller('prices')
@UseGuards(SessionGuard, MemberOrAdminGuard)
export class PriceListController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  getPrices() {
    return this.pricesService.getMemberPrices();
  }
}
