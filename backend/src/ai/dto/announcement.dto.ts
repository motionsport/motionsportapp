import { IsString, MaxLength } from 'class-validator';

// AI writes up to 150 chars; 500 leaves room for the trainer's edits
export class AnnouncementTextDto {
  @IsString()
  @MaxLength(500)
  text: string;
}
