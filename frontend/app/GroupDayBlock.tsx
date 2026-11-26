"use client";
import type { SlotView } from "@/lib/api";
import { SlotCard } from "@/components/schedule/SlotCard";
import { opensBadge } from "@/lib/bookingOpens";

interface GroupDayBlockProps {
  localDate: string;
  serverTime: string;
  bookingOpenAt: string | null;
  bookingCloseAt: string | null;
  slots: SlotView[];
  groupPassLeft: number;
  frozen: boolean; // frozen on this day: no booking
  onMutate: (fn: () => Promise<unknown>) => void;
  onRefresh: () => void;
}

// One day's group trainings with the booking badge: the next training day, and under it tomorrow's morning ones
// when they open with this day's evening («Завтра зранку»)
export default function GroupDayBlock({
  localDate,
  serverTime,
  bookingOpenAt,
  bookingCloseAt,
  slots,
  groupPassLeft,
  frozen,
  onMutate,
  onRefresh,
}: GroupDayBlockProps) {
  const now = new Date(serverTime);
  const beforeWindow = bookingOpenAt ? now < new Date(bookingOpenAt) : false;
  const afterWindow = bookingCloseAt ? now >= new Date(bookingCloseAt) : false;

  return (
    <div className="rounded-2xl border border-line p-3 flex flex-col space-y-3">
      <div className="flex items-center">
        {beforeWindow && bookingOpenAt ? (
          <span className="text-xs text-muted bg-surface border border-line rounded-full px-3 py-1">
            {opensBadge(bookingOpenAt, localDate, serverTime)}
          </span>
        ) : afterWindow ? (
          <span className="text-xs text-muted bg-surface border border-line rounded-full px-3 py-1">Запис закрито</span>
        ) : (
          <span className="text-sm font-semibold uppercase tracking-wide text-teal bg-teal/10 border border-teal/30 rounded-full px-4 py-1.5 flex items-center space-x-1.5">
            <span className="relative flex w-3 h-3 shrink-0 items-center justify-center mr-1.5">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-teal opacity-75"></span>
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-teal"></span>
            </span>
            Запис відкрито
          </span>
        )}
      </div>
      {slots.map((slot) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          allSlots={slots}
          groupPassLeft={groupPassLeft}
          localDate={localDate}
          serverTime={serverTime}
          afterWindow={afterWindow}
          frozen={frozen}
          onMutate={onMutate}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
