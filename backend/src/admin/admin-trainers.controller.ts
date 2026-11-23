import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { AdminTrainersService } from './admin-trainers.service';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { OwnerGuard } from '../common/guards/owner.guard';
import { DisableTrainerDto } from './dto/disable-trainer.dto';

// Trainers: the list only, for picking a client's trainer
@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminTrainersController {
  constructor(private readonly adminTrainersService: AdminTrainersService) {}

  @Get('trainers')
  getTrainers() {
    return this.adminTrainersService.getTrainers();
  }
}

// The owner: «Тренери» with «Вимкнути» (only the owner disables trainers, since 2026-11-23)
@Controller('owner/trainers')
@UseGuards(SessionGuard, OwnerGuard)
export class OwnerTrainersController {
  constructor(private readonly adminTrainersService: AdminTrainersService) {}

  @Get()
  getTrainers() {
    return this.adminTrainersService.getTrainers();
  }

  @Post(':trainerId/disable')
  @HttpCode(HttpStatus.OK)
  disableTrainer(@Param('trainerId', ParseUUIDPipe) trainerId: string, @Body() dto: DisableTrainerDto) {
    return this.adminTrainersService.disableTrainer(trainerId, dto.transferToId);
  }
}
