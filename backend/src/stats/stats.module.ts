import { Module } from '@nestjs/common';
import { StatsController, OwnerStatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StatsController, OwnerStatsController],
  providers: [StatsService],
})
export class StatsModule {}
