import type { PurchaseMethod } from "./api";

// How a purchase was paid, in the trainer's lists
export const METHOD_LABEL: Record<PurchaseMethod, string> = {
  LIQPAY: "онлайн",
  CASH: "готівка",
  TRANSFER: "переказ",
};
