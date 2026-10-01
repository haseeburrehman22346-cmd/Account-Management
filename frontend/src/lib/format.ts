export const CURRENCY = "PKR";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** e.g. 482650 -> "PKR 482,650" */
export const formatMoney = (amount: number) => `${CURRENCY} ${number.format(amount)}`;

/** Amount without the currency label, for tables whose header already says (PKR). */
export const formatAmount = (amount: number) => number.format(amount);

/** Axis-friendly, e.g. 200000 -> "200K" */
export const formatCompact = (amount: number) => compact.format(amount);

export const formatPct = (pct: number) => `${pct > 0 ? "+" : ""}${pct}%`;

/** Formats a YYYY-MM-DD string without shifting it through the local timezone. */
export const formatDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

/** "2026-04" -> "Apr" (or "Apr 2026" with year) */
export const formatMonth = (monthKey: string, withYear = false) =>
  new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    ...(withYear && { year: "numeric" }),
  });

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");
