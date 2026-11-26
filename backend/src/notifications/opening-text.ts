import { timeList } from '../schedule/time-list';

// The booking-open push: what opened at the trainer's opening time, today's evening trainings and tomorrow's morning
// ones (slotOpensAt). Words as on the home page's badge (singular / plural by count), times without a leading zero
export function openingText(evening: string[], morning: string[]): string {
  const eveningPart = `${evening.length > 1 ? 'вечірні групові' : 'вечірнє групове'} сьогодні о ${timeList(evening)}`;
  const several = morning.length > 1;
  // With the evening before it «групові» is already said: «та на ранкове завтра о 9:00»
  if (evening.length > 0 && morning.length > 0) {
    return `Записуйтесь на ${eveningPart} та на ${several ? 'ранкові' : 'ранкове'} завтра о ${timeList(morning)}`;
  }
  if (evening.length > 0) return `Записуйтесь на ${eveningPart}`;
  return `Записуйтесь на ${several ? 'ранкові групові' : 'ранкове групове'} завтра о ${timeList(morning)}`;
}
