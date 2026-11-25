import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementTextDto } from './dto/announcement.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionUser } from '../auth/session.guard';
import { ParseDatePipe } from '../common/pipes/date-pipes';

@Controller('admin/announcement-examples')
@UseGuards(SessionGuard, AdminGuard)
export class AnnouncementExamplesController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.announcements.listExamples(user.id);
  }

  @Post()
  add(@Body() body: AnnouncementTextDto, @CurrentUser() user: SessionUser) {
    return this.announcements.addExample(user.id, body.text);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser) {
    return this.announcements.deleteExample(user.id, id);
  }
}

@Controller('admin/announcements')
@UseGuards(SessionGuard, AdminGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get(':date')
  get(@Param('date', ParseDatePipe) date: string, @CurrentUser() user: SessionUser) {
    return this.announcements.getOrCreateForDate(date, user.id);
  }

  @Post(':date/generate')
  @HttpCode(200)
  generate(@Param('date', ParseDatePipe) date: string, @CurrentUser() user: SessionUser) {
    return this.announcements.generateAndSave(date, user.id);
  }

  @Put(':date/text')
  updateText(
    @Param('date', ParseDatePipe) date: string,
    @Body() body: AnnouncementTextDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.announcements.updateText(date, user.id, body.text);
  }

  @Post(':date/publish')
  @HttpCode(200)
  publish(@Param('date', ParseDatePipe) date: string, @CurrentUser() user: SessionUser) {
    return this.announcements.publish(date, user.id);
  }

  @Post(':date/unpublish')
  @HttpCode(200)
  unpublish(@Param('date', ParseDatePipe) date: string, @CurrentUser() user: SessionUser) {
    return this.announcements.unpublish(date, user.id);
  }
}
