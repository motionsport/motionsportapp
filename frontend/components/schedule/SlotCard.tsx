"use client";
import { useState } from "react";
import { api, SlotView } from "@/lib/api";
import { ensurePushSubscribed } from "@/lib/pushUtils";
import { CancellationReasonModal } from "./CancellationReasonModal";
import { GroupPassModal } from "./GroupPassModal";
import { OverNormModal } from "./OverNormModal";
import { WarnNote } from "@/components/ui/WarnNote";
import { crowdedText, lighterHint, lighterSlot, overNorm } from "@/lib/groupLoad";
import { kyivTime } from "@/lib/kyivTime";

// Same threshold as the backend's SMALL_GROUP_MAX (the trainer's push) and the admin SlotCard's «мало учасників»
const SMALL_GROUP_MAX = 2;

// Group slot: needs a group pass (else booking offers to buy one); booking, cancelling, switching end at the start.
// Books past the norm («9/8») up to capacity, after a warning that suggests a time with fewer people
interface SlotCardProps {
  slot: SlotView;
  allSlots: SlotView[];
  groupPassLeft: number;
  bookingWindowOpen: boolean;
  afterWindow: boolean;
  bookingOpenAt: string | null;
  frozen: boolean; // frozen on this day: no booking
  onMutate: (fn: () => Promise<unknown>) => void;
  onRefresh: () => void;
}

export function SlotCard({
  slot,
  allSlots,
  groupPassLeft,
  bookingWindowOpen,
  afterWindow,
  bookingOpenAt,
  frozen,
  onMutate,
  onRefresh,
}: SlotCardProps) {
  const [modal, setModal] = useState<{ action: "cancel" } | { action: "switch"; targetSlot: SlotView } | null>(null);
  // The slot a group pass is being bought for (this one, or the time suggested by the over-norm warning)
  const [buying, setBuying] = useState<SlotView | null>(null);
  const [overNormOpen, setOverNormOpen] = useState(false);
  // null = guest name field closed
  const [guestName, setGuestName] = useState<string | null>(null);

  const otherSlot = allSlots.find((s) => s.id !== slot.id && s.status === "ACTIVE" && !s.started && !s.lateCancelled);
  // The guest moves along and needs a seat too
  const seatsNeeded = slot.myGuest ? 2 : 1;
  const canSwitch = !!otherSlot && otherSlot.bookedCount + seatsNeeded <= otherSlot.capacity;
  // Moving there takes it past its norm: the reason modal warns
  const switchCrowded = otherSlot && overNorm(otherSlot, seatsNeeded) ? crowdedText(otherSlot) : null;

  const isFull = slot.bookedCount >= slot.capacity;
  const hasAnyBooking = allSlots.some((s) => s.isMyBooking);
  // 1 or 2 booked (guests count): the trainer may cancel it. Everyone sees it while booking is open;
  // nobody booked yet shows nothing (right after booking opens it would only scare people off)
  const smallGroup =
    slot.bookedCount > 0 &&
    slot.bookedCount <= SMALL_GROUP_MAX &&
    slot.status === "ACTIVE" &&
    !afterWindow &&
    !slot.started &&
    bookingWindowOpen;

  const bookable = slot.status === "ACTIVE" && !afterWindow && !slot.started && bookingWindowOpen && !frozen;
  // «На 20:00 вільніше»: this time is filling up and another has fewer people. Only for choosing
  // a time: a member already booked that day doesn't see it
  const lighter = bookable && !hasAnyBooking ? lighterHint(slot, allSlots) : null;

  const book = (target: SlotView) => {
    setOverNormOpen(false);
    if (groupPassLeft > 0) onMutate(() => api.book(target.id));
    else setBuying(target);
  };
  const subscribeVacancy = async () => {
    setOverNormOpen(false);
    await ensurePushSubscribed();
    await onMutate(() => api.subscribeVacancy(slot.id));
    onRefresh();
  };
  const unsubscribeVacancy = async () => {
    await onMutate(() => api.unsubscribeVacancy(slot.id));
    onRefresh();
  };

  const cardClass = slot.isMyBooking
    ? "bg-teal/5 border-teal"
    : isFull
      ? "bg-surface border-line"
      : "bg-surface border-line";

  return (
    <>
      <div className={`rounded-xl border-2 p-5 ${cardClass}`}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-geologica font-semibold text-title text-heading">{slot.slotTime}</span>
          <span className="text-muted text-sm">
            {slot.bookedCount}/{slot.norm} місць
          </span>
        </div>

        {lighter && <p className="text-accent text-xs -mt-2 mb-4">На {lighter.slotTime} вільніше</p>}

        {smallGroup && (
          <WarnNote title="Записалось мало людей" className="mb-4">
            Тренування відбудеться, якщо запишеться ще кілька людей
          </WarnNote>
        )}

        {slot.status === "CANCELLED" ? (
          <p className="text-danger text-sm font-medium">Скасовано</p>
        ) : frozen ? (
          <p className="text-muted text-sm">Заморожено</p>
        ) : afterWindow || slot.started ? (
          <p className="text-muted text-sm">Запис закрито</p>
        ) : !bookingWindowOpen ? (
          <p className="text-muted text-sm">
            {bookingOpenAt ? `Запис відкриється о ${kyivTime(bookingOpenAt)}` : "Запис ще не відкрився"}
          </p>
        ) : slot.isMyBooking ? (
          <div className="flex flex-col space-y-2">
            {slot.myGuest ? (
              <div className="flex items-center justify-between space-x-3 rounded-lg border border-line px-3 py-2.5">
                <span className="text-body text-sm">
                  <span className="text-subtle">Гість:</span> {slot.myGuest.name}
                </span>
                <button
                  type="button"
                  onClick={() => onMutate(() => api.removeGuest(slot.id))}
                  className="text-subtle text-xs underline hover:text-body transition-colors"
                >
                  Прибрати
                </button>
              </div>
            ) : guestName !== null ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!guestName.trim()) return;
                  onMutate(() => api.addGuest(slot.id, guestName.trim()));
                  setGuestName(null);
                }}
                className="flex flex-col space-y-2"
              >
                {overNorm(slot) && <p className="text-warn text-xs">{crowdedText(slot)}</p>}
                <input
                  autoFocus
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={40}
                  placeholder="Ім'я гостя"
                  className="input-field w-full border rounded-lg px-4 py-3 text-sm focus:outline-none"
                />
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={!guestName.trim()}
                    className="btn-primary flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    Додати гостя
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestName(null)}
                    className="btn-ghost flex-1 py-2.5 rounded-lg border text-sm transition-colors"
                  >
                    Ні
                  </button>
                </div>
              </form>
            ) : (
              !isFull && (
                <button
                  type="button"
                  onClick={() => setGuestName("")}
                  className="btn-ghost w-full py-3 rounded-lg border text-sm transition-colors"
                >
                  + Привести гостя
                </button>
              )
            )}
            {otherSlot && canSwitch && (
              <button
                type="button"
                onClick={() => setModal({ action: "switch", targetSlot: otherSlot })}
                className="btn-secondary w-full py-3 rounded-lg border text-sm transition-colors"
              >
                Перейти на {otherSlot.slotTime}
              </button>
            )}
            <button
              type="button"
              onClick={() => setModal({ action: "cancel" })}
              className="btn-danger w-full py-3 rounded-lg text-sm transition-colors"
            >
              Скасувати
            </button>
          </div>
        ) : slot.lateCancelled ? (
          <p className="text-muted text-sm">Ви скасували це тренування пізно, записатися знову не можна</p>
        ) : hasAnyBooking && !isFull ? (
          <p className="text-muted text-sm">Ви вже записані на інший час</p>
        ) : !isFull ? (
          <div className="flex flex-col space-y-2">
            <button
              type="button"
              onClick={() => (overNorm(slot) ? setOverNormOpen(true) : book(slot))}
              className="btn-primary w-full py-3 rounded-lg text-sm transition-colors"
            >
              Записатись
            </button>
            {/* Turned on from the over-norm warning: waits for a seat within the norm */}
            {slot.isMyVacancyAlert && (
              <button
                type="button"
                onClick={unsubscribeVacancy}
                className="btn-secondary w-full py-3 rounded-lg border text-sm transition-colors"
              >
                🔔 Сповіщення увімкнено
              </button>
            )}
          </div>
        ) : (
          // Also offered to a member booked on the other time: a freed seat shows them "Перейти на …"
          <div className="flex flex-col space-y-2">
            <p className="text-muted text-sm font-medium">Місць немає</p>
            {bookingWindowOpen &&
              (slot.isMyVacancyAlert ? (
                <button
                  type="button"
                  onClick={unsubscribeVacancy}
                  className="btn-secondary w-full py-3 rounded-lg border text-sm transition-colors"
                >
                  🔔 Сповіщення увімкнено
                </button>
              ) : (
                <button
                  type="button"
                  onClick={subscribeVacancy}
                  className="btn-ghost text-subtle border-subtle/40 hover:text-accent hover:border-teal w-full py-3 rounded-lg border text-sm transition-colors"
                >
                  🔕 Сповістити про вільне місце
                </button>
              ))}
          </div>
        )}
      </div>

      {overNormOpen && (
        <OverNormModal
          slot={slot}
          lighter={lighterSlot(slot, allSlots)}
          onBook={book}
          onAlert={slot.isMyVacancyAlert ? null : subscribeVacancy}
          onDismiss={() => setOverNormOpen(false)}
        />
      )}

      {buying && (
        <GroupPassModal
          slotId={buying.id}
          slotTime={buying.slotTime}
          onDismiss={() => setBuying(null)}
          onBooked={onRefresh}
        />
      )}

      {modal && (
        <CancellationReasonModal
          action={modal.action}
          switchTime={modal.action === "switch" ? modal.targetSlot.slotTime : undefined}
          crowded={modal.action === "switch" ? switchCrowded : null}
          slotId={slot.id}
          onDismiss={() => setModal(null)}
          onConfirm={async (reason) => {
            setModal(null);
            if (modal.action === "cancel") {
              await onMutate(() => api.cancelBooking(slot.id, reason));
            } else {
              await onMutate(() => api.switchSlot(modal.targetSlot.id, reason));
              onRefresh();
            }
          }}
        />
      )}
    </>
  );
}
