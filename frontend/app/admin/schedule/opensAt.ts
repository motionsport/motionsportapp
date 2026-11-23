// The booking opening stays on quarters of an hour: the booking-open push runs every 15 minutes.
// The phone's time picker allows any minute, so the error names the four allowed times of that hour
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function opensAtError(time: string): string | null {
  const m = TIME_RE.exec(time);
  if (!m) return "Вкажіть, о котрій відкривається запис, наприклад 14:00";
  if (Number(m[2]) % 15 === 0) return null;
  const quarters = ["00", "15", "30", "45"].map((min) => `${m[1]}:${min}`);
  return `Запис може відкриватися лише о ${quarters.slice(0, 3).join(", ")} або ${quarters[3]}`;
}
