import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PERMANENT_KINDS, type PermanentKind } from '../../permanent-discounts/rules';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

class InviteClubCardDto {
  @IsUUID('all')
  priceItemId: string;

  // The last day; missing / null = waits for activation, like a reception card
  @IsOptional()
  @Matches(DATE)
  validUntil?: string | null;
}

class InvitePackageDto {
  // The package as the price list sells it («Персональне · 8 тренувань»): its type and name come from there
  @IsUUID('all')
  priceItemId: string;

  // Trainings left (at most the package's size: checked by the service)
  @IsInt()
  @Min(1)
  @Max(30)
  left: number;

  @Matches(DATE)
  validUntil: string;
}

// Format only; dates not in the past and the club card's price item are checked by the service
export class CreateMemberInviteDto {
  @IsString()
  // Like a member's own sign-up name (2+), short enough for the trainer's lists
  @MinLength(2)
  @MaxLength(40)
  displayName: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InviteClubCardDto)
  clubCard?: InviteClubCardDto | null;

  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => InvitePackageDto)
  packages: InvitePackageDto[];

  @IsOptional()
  @IsIn(PERMANENT_KINDS)
  permanentDiscount?: PermanentKind | null;
}
