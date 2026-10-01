export type CategoryStatus = "active" | "inactive";

export interface CategoryUser {
  id: string;
  name: string;
  email: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  budgetLimit: number | null;
  status: CategoryStatus;
  createdBy: string;
  assignedUsers: CategoryUser[];
  totalSpent: number;
  expenseCount: number;
  totalGrowthPct: number | null;
  thisMonthSpent: number;
  thisMonthCount: number;
  thisMonthAverage: number;
  thisMonthGrowthPct: number | null;
  canAddExpense: boolean;
}

export interface CategoryMember extends CategoryUser {
  totalSpent: number;
  expenseCount: number;
}

export interface CategoryInput {
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  budgetLimit: number | null;
  status: CategoryStatus;
  assignedUserIds: string[];
}
