// The booking-open push: what opened at the trainer's opening time, today's evening trainings and tomorrow's morning
// ones (slotOpensAt). Words as on the home page's badge (singular / plural by count), times without a leading zero
const time = (slotTime: string) => slotTime.replace(/^0/, '');

function times(slotTimes: string[]): string {
  const list = [...slotTimes].sort().map(time);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} і ${list.at(-1)}` : list[0];
}

export function openingText(evening: string[], morning: string[]): string {
  const eveningPart = `${evening.length > 1 ? 'вечірні групові' : 'вечірнє групове'} сьогодні о ${times(evening)}`;
  const several = morning.length > 1;
  // With the evening before it «групові» is already said: «та на ранкове завтра о 9:00»
  if (evening.length > 0 && morning.length > 0) {
    return `Записуйтесь на ${eveningPart} та на ${several ? 'ранкові' : 'ранкове'} завтра о ${times(morning)}`;
  }
  if (evening.length > 0) return `Записуйтесь на ${eveningPart}`;
  return `Записуйтесь на ${several ? 'ранкові групові' : 'ранкове групове'} завтра о ${times(morning)}`;
}
