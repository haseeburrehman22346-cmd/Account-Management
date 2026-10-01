/** Month keys are 'YYYY-MM', matching the first 7 chars of an expense's 'YYYY-MM-DD' date. */
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

/** The last `n` month keys, oldest first, ending with the current month. */
export const lastMonths = (n: number) => {
  const current = monthKey();
  return Array.from({ length: n }, (_, i) => shiftMonth(current, i - (n - 1)));
};

export const growthPct = (current: number, previous: number) =>
  previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
