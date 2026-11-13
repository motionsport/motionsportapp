import { DateTime } from 'luxon';

export const KY_ZONE = 'Europe/Kyiv';

// DB / API values; only the frontend turns them into words
export const GROUP_TYPE = 'group';
// A group training takes up to GROUP_CAPACITY (booking closes there); GROUP_NORM is the comfortable size the
// counters show («9/8»). Booking past the norm is allowed with a warning; a seat freed below it is «З'явилось місце»
export const GROUP_CAPACITY = 15;
export const GROUP_NORM = 8;
// A group training this small (guests count) gets a line in the trainer's cancel push; the trainer decides,
// nothing is cancelled. Same threshold as `belowMin` in frontend SlotCard.tsx
export const SMALL_GROUP_MAX = 2;
// Assigned slots: the trainer picks the members (slot_members); only they see the slot
export const ASSIGNED_TYPES = ['personal', 'split'];
export const PASS_TYPES = [GROUP_TYPE, ...ASSIGNED_TYPES];
// Capacity is always `max`, however many members are assigned
export const ASSIGNED_MEMBER_LIMITS: Record<string, { min: number; max: number }> = {
  personal: { min: 1, max: 1 },
  split: { min: 1, max: 3 },
};

// The size counters show: the norm for a group, the fixed capacity for an assigned slot
export function slotNorm(slot: { trainingType: string; capacity: number }) {
  return slot.trainingType === GROUP_TYPE ? GROUP_NORM : slot.capacity;
}

export function isAssignedType(trainingType: string) {
  return ASSIGNED_TYPES.includes(trainingType);
}

export function slotStartsAt(localDate: string, slotTime: string) {
  return DateTime.fromISO(`${localDate}T${slotTime}:00`, { zone: KY_ZONE });
}

// Used by the auto-attendance cron and by trainer disabling (an over training is left as is)
export function slotOverAt(localDate: string, slotTime: string) {
  return slotStartsAt(localDate, slotTime).plus({ hours: 1 });
}
