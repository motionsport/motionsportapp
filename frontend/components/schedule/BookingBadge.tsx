import { Badge } from "@/components/ui/Badge";
import { opensBadge } from "@/lib/bookingOpens";

type BadgeSlot = { status: string; started?: boolean; bookingOpenAt?: string };

// The day's booking state, one badge for the member's home page and the trainer's panel: «Запис відкрито», «Запис
// закрито», or what opens next («Запис на ранкове групове відкриється сьогодні о 16:00», lib/bookingOpens.ts).
// Moments from the API, compared in server time (serverTime), so a wrong phone clock is harmless
export function BookingBadge({
  localDate,
  serverTime,
  bookingOpenAt,
  bookingCloseAt,
  slots,
}: {
  localDate: string;
  serverTime: string;
  bookingOpenAt: string | null;
  bookingCloseAt: string | null;
  slots: BadgeSlot[];
}) {
  const now = new Date(serverTime);
  if (bookingOpenAt && now < new Date(bookingOpenAt)) {
    return <Badge>{opensBadge(bookingOpenAt, localDate, slots, serverTime)}</Badge>;
  }
  if (bookingCloseAt && now >= new Date(bookingCloseAt)) return <Badge>Запис закрито</Badge>;
  return (
    <span className="text-sm font-semibold uppercase tracking-wide text-teal bg-teal/10 border border-teal/30 rounded-full px-4 py-1.5 flex items-center space-x-1.5">
      <span className="relative flex w-3 h-3 shrink-0 items-center justify-center mr-1.5">
        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-teal opacity-75"></span>
        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-teal"></span>
      </span>
      Запис відкрито
    </span>
  );
}
