import { growthPct, monthKey, shiftMonth } from './dates.js';
import { fromCents } from './money.js';

export interface SummaryRow {
  totalCents: number;
  count: number;
  thisMonthCents: number;
  thisMonthCount: number;
  lastMonthCents: number;
  beforeThisMonthCents: number;
}

/**
 * $group accumulators shared by every "totals + this month vs last month" figure,
 * so the dashboard, category list and category detail all agree.
 */
export function summaryAccumulators() {
  const thisMonth = monthKey();
  const lastMonth = shiftMonth(thisMonth, -1);
  const month = { $substrBytes: ['$date', 0, 7] };
  const sumIf = (cond: object) => ({ $sum: { $cond: [cond, '$amountCents', 0] } });

  return {
    totalCents: { $sum: '$amountCents' },
    count: { $sum: 1 },
    thisMonthCents: sumIf({ $eq: [month, thisMonth] }),
    thisMonthCount: { $sum: { $cond: [{ $eq: [month, thisMonth] }, 1, 0] } },
    lastMonthCents: sumIf({ $eq: [month, lastMonth] }),
    beforeThisMonthCents: sumIf({ $lt: [month, thisMonth] }),
  };
}

export const EMPTY_SUMMARY: SummaryRow = {
  totalCents: 0,
  count: 0,
  thisMonthCents: 0,
  thisMonthCount: 0,
  lastMonthCents: 0,
  beforeThisMonthCents: 0,
};

export function toSummaryDto(row: SummaryRow = EMPTY_SUMMARY) {
  return {
    totalSpent: fromCents(row.totalCents),
    expenseCount: row.count,
    // Growth of the running total since the end of last month.
    totalGrowthPct: growthPct(row.totalCents, row.beforeThisMonthCents),
    thisMonthSpent: fromCents(row.thisMonthCents),
    thisMonthCount: row.thisMonthCount,
    thisMonthAverage: row.thisMonthCount ? fromCents(Math.round(row.thisMonthCents / row.thisMonthCount)) : 0,
    thisMonthGrowthPct: growthPct(row.thisMonthCents, row.lastMonthCents),
  };
}
