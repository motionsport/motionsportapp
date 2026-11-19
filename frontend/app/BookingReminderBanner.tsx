"use client";

import { useEffect, useState } from "react";
import type { BookingReminder } from "@/lib/api";
import { reminderState } from "@/lib/bookingReminder";

// «Сьогодні тренування» above «Наступне тренування»; ticks every second in server time
export default function BookingReminderBanner({
  reminder,
  serverTime,
}: {
  reminder: BookingReminder | null;
  serverTime: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!reminder) return;
    const offset = Date.parse(serverTime) - Date.now();
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [reminder, serverTime]);

  const state = now === null ? null : reminderState(reminder, now);
  if (!state) return null;

  return (
    <div className="rounded-xl border border-teal bg-teal/10 px-4 py-3 mb-5">
      <p className="font-geologica font-semibold text-heading uppercase">Сьогодні тренування</p>
      <p className="text-body text-base">Запишіться, щоб не пропустити</p>
      {state.kind === "countdown" ? (
        <p className="text-accent text-base mt-2">
          До закриття запису залишилось <span className="font-semibold tabular-nums">{state.left}</span>
        </p>
      ) : (
        <p className="text-accent text-base font-semibold mt-2">Запис ще відкритий, встигніть!</p>
      )}
    </div>
  );
}
