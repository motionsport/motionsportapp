import { describe, expect, it } from "vitest";
import { hms, reminderState } from "./bookingReminder";

// First group training at 19:00 Kyiv (17:00 UTC): from 16:00, countdown to 18:00
const reminder = {
  from: "2026-11-19T14:00:00.000Z",
  softDeadline: "2026-11-19T16:00:00.000Z",
  firstStart: "2026-11-19T17:00:00.000Z",
};
const at = (utc: string) => Date.parse(`2026-11-19T${utc}Z`);

describe("reminderState", () => {
  it("nothing before it starts", () => {
    expect(reminderState(reminder, at("13:59:59"))).toBeNull();
  });

  it("counts down to an hour before the first training", () => {
    expect(reminderState(reminder, at("14:00:00"))).toEqual({ kind: "countdown", left: "2:00:00" });
    expect(reminderState(reminder, at("14:00:01"))).toEqual({ kind: "countdown", left: "1:59:59" });
    expect(reminderState(reminder, at("15:59:59"))).toEqual({ kind: "countdown", left: "0:00:01" });
  });

  it("«встигніть» from an hour before until the start", () => {
    expect(reminderState(reminder, at("16:00:00"))).toEqual({ kind: "hurry" });
    expect(reminderState(reminder, at("16:59:59"))).toEqual({ kind: "hurry" });
  });

  it("gone once the first training starts", () => {
    expect(reminderState(reminder, at("17:00:00"))).toBeNull();
  });

  it("no reminder (booked, no group package, frozen): nothing", () => {
    expect(reminderState(null, at("15:00:00"))).toBeNull();
  });
});

describe("hms", () => {
  it("hours, minutes and seconds", () => {
    expect(hms(7_199_000)).toBe("1:59:59");
    expect(hms(65_000)).toBe("0:01:05");
    expect(hms(500)).toBe("0:00:01");
  });
});
