// A group training left small (2 or fewer) after someone cancelled or moved away: the trainer may cancel it,
// so the card asks people to come. Shown while booking is open, to the booked and to those who can book
export interface SmallGroupNote {
  text: string;
  hint: string | null;
}

export function smallGroupNote(opts: {
  smallGroup: boolean;
  bookedCount: number;
  isMyBooking: boolean;
  canBook: boolean; // not booked elsewhere today, not cancelled late, a free seat
}): SmallGroupNote | null {
  const { smallGroup, bookedCount, isMyBooking, canBook } = opts;
  if (!smallGroup) return null;
  if (isMyBooking) {
    const who = bookedCount <= 1 ? "Поки записані лише ви." : `Поки записано лише ${bookedCount}.`;
    return {
      text: `${who} Покличте друга (гість безкоштовно), щоб тренування точно відбулося`,
      hint: "Якщо тренер скасує, прийде сповіщення, нічого не списується",
    };
  }
  if (!canBook) return null;
  if (bookedCount === 0) {
    return { text: "Поки ніхто не записаний. Запишіться першим, щоб тренування відбулося", hint: null };
  }
  return { text: `Поки записано лише ${bookedCount}. Запишіться, щоб тренування точно відбулося`, hint: null };
}
