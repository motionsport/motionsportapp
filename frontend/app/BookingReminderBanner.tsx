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
    // Solid lime with dark text, like the primary button: the loudest block on the page
    <div className="rounded-xl bg-teal text-on-teal p-4 mb-5">
      <div className="flex items-start justify-between space-x-3">
        <div className="min-w-0">
          <p className="font-geologica font-semibold text-sm uppercase">Сьогодні тренування</p>
          <p className="text-base font-medium">Запишіться, щоб не пропустити</p>
        </div>
        {state.kind === "countdown" && (
          <div className="text-right shrink-0">
            <p className="font-geologica font-semibold text-[28px] leading-none tabular-nums">{state.left}</p>
            <p className="text-xs font-medium opacity-75 mt-1 whitespace-nowrap">до закриття запису</p>
          </div>
        )}
      </div>
      {state.kind === "hurry" && <p className="text-base font-semibold mt-2">Запис ще відкритий, встигніть!</p>}
    </div>
  );
}
