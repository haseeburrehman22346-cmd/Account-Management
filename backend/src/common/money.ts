/** Money is stored as integer cents to avoid floating-point drift in totals. */
export const toCents = (amount: number) => Math.round(amount * 100);
export const fromCents = (cents: number) => cents / 100;
