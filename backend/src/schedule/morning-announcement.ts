import { DateTime } from 'luxon';
import { timeList } from './time-list';

// «у понеділок» … «у неділю», Luxon weekday 1 = Mon
const ON_WEEKDAY = ['у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у пʼятницю', 'у суботу', 'у неділю'];

// The home page's announcement while booking is open for a day's morning group trainings (they open the day before,
// so no AI «сьогодні» text yet): a fixed text naming the day, right the day before and on the day, no editing
export function morningAnnouncement(localDate: string, slotTimes: string[]): string {
  const several = slotTimes.length > 1;
  const day = ON_WEEKDAY[DateTime.fromISO(localDate).weekday - 1];
  return `Записуйтесь на ${several ? 'ранкові тренування' : 'ранкове тренування'}! Чекаємо вас ${day} о ${timeList(slotTimes)}.`;
}
