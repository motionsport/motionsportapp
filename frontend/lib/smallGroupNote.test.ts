import { describe, expect, it } from "vitest";
import { smallGroupNote } from "./smallGroupNote";

const base = { smallGroup: true, bookedCount: 2, isMyBooking: false, canBook: true };

describe("smallGroupNote", () => {
  it("nothing unless the group became small after someone left", () => {
    expect(smallGroupNote({ ...base, smallGroup: false })).toBeNull();
  });

  it("asks those who can book to come", () => {
    expect(smallGroupNote(base)).toEqual({
      text: "Поки записано лише 2. Запишіться, щоб тренування точно відбулося",
      hint: null,
    });
    expect(smallGroupNote({ ...base, bookedCount: 0 })?.text).toBe(
      "Поки ніхто не записаний. Запишіться першим, щоб тренування відбулося",
    );
  });

  it("asks the booked to bring a friend and says nothing is spent if cancelled", () => {
    expect(smallGroupNote({ ...base, isMyBooking: true })).toEqual({
      text: "Поки записано лише 2. Покличте друга (гість безкоштовно), щоб тренування точно відбулося",
      hint: "Якщо тренер скасує, прийде сповіщення, нічого не списується",
    });
    expect(smallGroupNote({ ...base, isMyBooking: true, bookedCount: 1 })?.text).toMatch(/^Поки записані лише ви\./);
  });

  it("nothing for someone who can't book it (booked elsewhere, cancelled late)", () => {
    expect(smallGroupNote({ ...base, canBook: false })).toBeNull();
  });
});
