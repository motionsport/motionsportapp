"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { reloadTo } from "@/lib/loginRedirect";
import Link from "next/link";
import { api, DiscountView, ScheduleNext, statusOf } from "@/lib/api";
import { PageLayout } from "@/components/ui/PageLayout";
import { AssignedSlotCard } from "@/components/schedule/AssignedSlotCard";
import { resyncExistingSubscription } from "@/lib/pushUtils";
import { nextPollDelay } from "@/lib/schedulePoll";
import { errorText } from "@/lib/apiErrors";
import { ddmm, longDay } from "@/lib/dates";
import BookingReminderBanner from "./BookingReminderBanner";
import EndingPackagesBanner from "./EndingPackagesBanner";
import GroupDayBlock from "./GroupDayBlock";
import ReviewPromoStrip from "./ReviewPromoStrip";
import { ReviewDiscountCard } from "@/components/discount/ReviewDiscountCard";

// `signedIn` = a member's role cookie (page.tsx): otherwise the landing, with no API call (no 401 in the console)
export default function SchedulePage({ signedIn }: { signedIn: boolean }) {
  const [schedule, setSchedule] = useState<ScheduleNext | null>(null);
  // false = session expired
  const [sessionOk, setAuthed] = useState<boolean | null>(null);
  const authed = signedIn ? sessionOk : false;
  const [loading, setLoading] = useState(true);
  const [mutateError, setMutateError] = useState("");
  // undefined = not loaded (or failed: nothing shown), null = no review discount given
  const [reviewDiscount, setReviewDiscount] = useState<{ percent: number; discount: DiscountView | null } | undefined>(
    undefined,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);
  const fetchRef = useRef<(() => Promise<void>) | null>(null);

  const authedRef = useRef(false);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // Every fetch, poll or mutation, reschedules the next poll
  const fetchSchedule = useCallback(async () => {
    let data: ScheduleNext | undefined;
    try {
      data = await api.getScheduleNext();
      setSchedule(data);
    } catch (err: unknown) {
      if (statusOf(err) === 401 && !authedRef.current) {
        setAuthed(false);
        setLoading(false);
        throw err;
      }
    }
    if (pollingRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Deliberately empty: fetchSchedule rethrows only after signing out
        fetchRef.current?.().catch(() => {});
      }, nextPollDelay(data));
    }
  }, []);

  // Not on every poll: after the first load, a booking with a pass and when the tab comes back.
  // Deliberately ignored on failure: the page just keeps what it shows
  const reloadDiscount = useCallback(() => {
    api
      .getReviewDiscount()
      .then(setReviewDiscount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchRef.current = fetchSchedule;
  }, [fetchSchedule]);

  const startPolling = useCallback(() => {
    pollingRef.current = true;
    fetchSchedule().catch(() => {}); // deliberately empty, as above
  }, [fetchSchedule]);

  useEffect(() => {
    if (!signedIn) return;

    pollingRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchSchedule is async: state is set after the await, not synchronously
    fetchSchedule()
      .then(() => {
        authedRef.current = true;
        setAuthed(true);
        setLoading(false);
        // Logout switched this browser's push off on the server; turn it back on
        resyncExistingSubscription();
        reloadDiscount();
      })
      .catch(() => stopPolling());

    const onVisibility = () => {
      if (document.hidden) stopPolling();
      else {
        startPolling();
        if (authedRef.current) reloadDiscount();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [signedIn, fetchSchedule, startPolling, stopPolling, reloadDiscount]);

  const handleMutate = async (fn: () => Promise<unknown>) => {
    setMutateError("");
    try {
      await fn();
      await fetchSchedule();
    } catch (err: unknown) {
      setMutateError(errorText(err));
    }
  };

  const refreshAll = async () => {
    reloadDiscount();
    await fetchSchedule();
  };

  const handleLogout = async () => {
    // Deliberately ignored: signed out or not, the login comes next
    await api.logout().catch(() => {});
    reloadTo("/login");
  };

  if (authed === null) {
    return <PageLayout loading />;
  }

  if (authed === false) {
    return (
      <PageLayout className="items-center text-center">
        <h1 className="font-geologica font-semibold text-display text-heading mb-3 uppercase">Motion Gym</h1>
        <div className="flex flex-col w-full max-w-xs space-y-3 mt-10">
          <Link
            href="/login"
            className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors text-center"
          >
            Увійти як клієнт
          </Link>
          <Link
            href="/admin/login"
            className="btn-secondary w-full py-4 rounded-lg border font-medium text-sm transition-colors text-center"
          >
            Вхід для команди
          </Link>
        </div>
      </PageLayout>
    );
  }

  const scheduleAction = (
    <div className="flex items-center space-x-4">
      <Link href="/purchases" className="text-sm text-accent hover:underline">
        Абонемент і пакети
      </Link>
      <button type="button" onClick={handleLogout} className="text-muted text-sm hover:text-body transition-colors">
        Вийти
      </button>
    </div>
  );

  if (!loading && !schedule) {
    return (
      <PageLayout variant="top" action={scheduleAction}>
        <p className="text-danger text-sm">Не вдалося завантажити розклад.</p>
      </PageLayout>
    );
  }

  const frozenThatDay = !!schedule?.frozenUntil && !!schedule.localDate && schedule.localDate <= schedule.frozenUntil;

  return (
    <PageLayout
      variant="top"
      loading={loading}
      action={scheduleAction}
      topBar={
        reviewDiscount && reviewDiscount.discount === null ? (
          <ReviewPromoStrip percent={reviewDiscount.percent} />
        ) : null
      }
    >
      {schedule && (
        <>
          <BookingReminderBanner reminder={schedule.bookingReminder} serverTime={schedule.serverTime} />
          <h1 className="font-geologica font-semibold text-title sm:text-display text-heading mb-1 uppercase">
            Наступне тренування
          </h1>

          {schedule.frozenUntil && (
            <Link
              href="/purchases"
              className="block bg-warn-bg border border-warn-line rounded-xl px-4 py-3 mb-4 text-sm text-warn"
            >
              Заморожено до {ddmm(schedule.frozenUntil)} включно
            </Link>
          )}

          {!schedule.localDate ? (
            <>
              <p className="text-muted text-sm mb-4">Групових тренувань поки не заплановано.</p>
              <EndingPackagesBanner packages={schedule.endingPackages ?? []} />
            </>
          ) : (
            <>
              <p className="text-muted text-sm mb-4 capitalize">{longDay(schedule.localDate)}</p>
              <EndingPackagesBanner packages={schedule.endingPackages ?? []} />

              {schedule.announcement && (
                <div className="bg-teal/8 border border-teal/20 rounded-xl px-4 py-3 mb-5 text-sm text-body">
                  {schedule.announcement}
                </div>
              )}

              <GroupDayBlock
                localDate={schedule.localDate}
                serverTime={schedule.serverTime}
                bookingOpenAt={schedule.bookingOpenAt}
                bookingCloseAt={schedule.bookingCloseAt}
                slots={schedule.slots}
                groupPassLeft={schedule.groupPassLeft ?? 0}
                frozen={frozenThatDay}
                onMutate={handleMutate}
                onRefresh={refreshAll}
              />

              {/* Tomorrow's morning trainings open with today's evening (a day before), so they show here too */}
              {schedule.nextMorning && (
                <>
                  <h2 className="font-geologica font-semibold text-heading uppercase mt-8 mb-1">Завтра зранку</h2>
                  <p className="text-muted text-sm mb-4 capitalize">{longDay(schedule.nextMorning.localDate)}</p>
                  <GroupDayBlock
                    localDate={schedule.nextMorning.localDate}
                    serverTime={schedule.serverTime}
                    bookingOpenAt={schedule.nextMorning.bookingOpenAt}
                    bookingCloseAt={schedule.nextMorning.bookingCloseAt}
                    slots={schedule.nextMorning.slots}
                    groupPassLeft={schedule.nextMorning.groupPassLeft}
                    frozen={schedule.nextMorning.frozen}
                    onMutate={handleMutate}
                    onRefresh={refreshAll}
                  />
                </>
              )}
            </>
          )}

          {!!schedule.assignedSlots?.length && (
            <>
              <h2 className="font-geologica font-semibold text-heading uppercase mt-8 mb-3">Мої тренування</h2>
              <div className="flex flex-col space-y-3">
                {schedule.assignedSlots.map((slot) => (
                  <AssignedSlotCard key={slot.id} slot={slot} onMutate={handleMutate} />
                ))}
              </div>
            </>
          )}

          {reviewDiscount?.discount && (
            <ReviewDiscountCard discount={reviewDiscount.discount} percent={reviewDiscount.percent} className="mt-8" />
          )}

          {mutateError && (
            <p role="alert" className="text-danger text-sm mt-4 text-center">
              {mutateError}
            </p>
          )}
        </>
      )}
    </PageLayout>
  );
}
