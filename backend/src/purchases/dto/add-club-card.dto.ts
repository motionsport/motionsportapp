import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AddClubCardDto {
  @IsUUID('all')
  priceItemId: string;

  // Active from today instead of waiting
  @IsOptional()
  @IsBoolean()
  activate?: boolean;

  // Take the 5% review discount off this card
  @IsOptional()
  @IsBoolean()
  applyDiscount?: boolean;
}
