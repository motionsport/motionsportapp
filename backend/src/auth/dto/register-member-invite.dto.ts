import { IsString, Matches, MaxLength } from 'class-validator';

// Sign-up by a trainer's invite: the name and what the client already has come from the invite
export class RegisterMemberInviteDto {
  @IsString()
  @MaxLength(200)
  token: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  pin: string;
}
