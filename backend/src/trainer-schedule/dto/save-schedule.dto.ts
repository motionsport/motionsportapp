import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HH_MM = /^\d{2}:\d{2}$/;

class ScheduleTimeDto {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number;

  @Matches(HH_MM)
  slotTime: string;
}

class ScheduleTopicDto {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number;

  // Trimmed by the service; an empty one is dropped
  @IsString()
  @MaxLength(80)
  topic: string;
}

// Format only; schedule rules are checked by the service (scheduleError)
export class SaveScheduleDto {
  @Matches(HH_MM)
  bookingOpensAt: string;

  @IsBoolean()
  autoCreate: boolean;

  @IsArray()
  @ArrayMaxSize(7 * 16)
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeDto)
  times: ScheduleTimeDto[];

  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ScheduleTopicDto)
  topics: ScheduleTopicDto[];
}
