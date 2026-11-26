"use client";
import type { SlotView } from "@/lib/api";
import { SlotCard } from "@/components/schedule/SlotCard";
import { BookingBadge } from "@/components/schedule/BookingBadge";

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
  const afterWindow = bookingCloseAt ? now >= new Date(bookingCloseAt) : false;

  return (
    <div className="rounded-2xl border border-line p-3 flex flex-col space-y-3">
      <div className="flex items-center">
        <BookingBadge
          localDate={localDate}
          serverTime={serverTime}
          bookingOpenAt={bookingOpenAt}
          bookingCloseAt={bookingCloseAt}
          slots={slots}
        />
      </div>
      {slots.map((slot) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          allSlots={slots}
          groupPassLeft={groupPassLeft}
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
