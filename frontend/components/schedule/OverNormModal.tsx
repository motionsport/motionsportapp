"use client";
import { SlotView } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { crowdedText, lighterText } from "@/lib/groupLoad";

// «Записатись» on a group training past its norm: suggest a time with fewer people, still let them book this one,
// or wait for a seat within the norm. Closes with the modal's ✕
export function OverNormModal({
  slot,
  lighter,
  onBook,
  onAlert,
  onDismiss,
}: {
  slot: SlotView;
  lighter: SlotView | null;
  onBook: (slot: SlotView) => void;
  onAlert: (() => void) | null; // null: already waiting for a seat here
  onDismiss: () => void;
}) {
  return (
    <Modal onDismiss={onDismiss} labelledBy="over-norm-title">
      <h2 id="over-norm-title" className="font-geologica font-semibold text-lg text-heading mb-3 pr-8">
        Записатись на {slot.slotTime}
      </h2>
      <p className="text-body text-base mb-1">{crowdedText(slot)}.</p>
      {lighter && <p className="text-body text-base">{lighterText(lighter)}.</p>}

      <div className="flex flex-col space-y-2 mt-5">
        {lighter ? (
          <>
            <button
              type="button"
              onClick={() => onBook(lighter)}
              className="btn-primary w-full py-3 rounded-lg text-sm font-medium transition-colors"
            >
              Записатись на {lighter.slotTime}
            </button>
            <button
              type="button"
              onClick={() => onBook(slot)}
              className="btn-secondary w-full py-3 rounded-lg border text-sm transition-colors"
            >
              Все одно на {slot.slotTime}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onBook(slot)}
            className="btn-primary w-full py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Записатись
          </button>
        )}
        {onAlert && (
          <button
            type="button"
            onClick={onAlert}
            className="btn-ghost hover-accent w-full py-3 rounded-lg border text-sm transition-colors"
          >
            Сповістити, якщо звільниться місце
          </button>
        )}
      </div>
    </Modal>
  );
}
