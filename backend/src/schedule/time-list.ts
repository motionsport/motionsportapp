// Training times in a sentence: «9:00», «19:00 і 20:00», «18:00, 19:00 і 20:00» (sorted, no leading zero).
// Shared by the booking-open push and the morning announcement
export function timeList(slotTimes: string[]): string {
  const list = [...slotTimes].sort().map((t) => t.replace(/^0/, ''));
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} і ${list.at(-1)}` : list[0];
}
