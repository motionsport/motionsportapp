import { PAYMENT_METHODS, type PaymentMethod } from '../../payment/payment-methods';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreatePurchaseDto {
  // A group pass alone; or a club card, a trainer service, or both
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsUUID('all', { each: true })
  priceItemIds: string[];

  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;

  // Group pass only: slot to book (cash, transfer: now; LiqPay: once paid)
  @IsOptional()
  @IsUUID('all')
  slotId?: string;
}
