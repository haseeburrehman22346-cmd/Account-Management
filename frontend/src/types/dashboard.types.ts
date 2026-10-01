import type { Expense } from "./expense.types";

export interface DashboardOverview {
  stats: {
    totalSpent: number;
    totalGrowthPct: number | null;
    thisMonthSpent: number;
    thisMonthGrowthPct: number | null;
    activeCategories: number;
    totalCategories: number;
    assignedUsers: number;
    totalUsers: number;
    standardUsers: number;
  };
  monthly: { month: string; total: number }[];
  byCategory: { id: string; name: string; icon: string | null; color: string | null; total: number; percent: number }[];
  recent: Expense[];
}
