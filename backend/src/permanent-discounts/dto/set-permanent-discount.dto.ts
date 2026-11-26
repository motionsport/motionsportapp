import { IsIn, IsOptional } from 'class-validator';
import { PERMANENT_KINDS, type PermanentKind } from '../rules';

export class SetPermanentDiscountDto {
  // null or missing = no mark
  @IsOptional()
  @IsIn(PERMANENT_KINDS)
  kind?: PermanentKind | null;
}
