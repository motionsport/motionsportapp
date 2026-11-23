import { plusDays } from '../freezes/rules';

// Marks, «Підтвердити всіх» and «Не списувати» stay open on the training day and 3 days after it; then the training
// is closed (trainer's wish, 2026-11-23: history is not rewritten). The 22:00 cron is not limited
export const MARKS_EDITABLE_DAYS = 3;

export const marksEditableUntil = (localDate: string) => plusDays(localDate, MARKS_EDITABLE_DAYS);

export const marksLocked = (localDate: string, today: string) => today > marksEditableUntil(localDate);
