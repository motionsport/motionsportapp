import { kyivToday } from "@/lib/dates";

const MIN_MONTHS = 12;

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// "YYYY-MM" from the first month with data (at least the last 12) to the current Kyiv month, oldest first
export function monthKeysUpToNow(withData: string[], today = kyivToday()): string[] {
  const [y, m] = today.split("-").map(Number);
  const first = withData.reduce((a, b) => (b < a ? b : a), key(new Date(y, m - 1, 1)));
  const keys: string[] = [];
  for (let i = 0; ; i++) {
    const k = key(new Date(y, m - 1 - i, 1));
    if (i >= MIN_MONTHS && k < first) break;
    keys.unshift(k);
  }
  return keys;
}

// "Жовтень 2026"
export function monthName(month: string) {
  const name = new Date(`${month}-01T12:00:00`).toLocaleDateString("uk-UA", { month: "long" });
  return `${name[0].toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}
