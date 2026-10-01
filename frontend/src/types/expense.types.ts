import type { UserRef } from "./user.types";

export interface ExpenseCategoryRef {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface Expense {
  id: string;
  categoryId: string;
  category: ExpenseCategoryRef;
  title: string;
  amount: number;
  /** ISO date, YYYY-MM-DD */
  date: string;
  note: string | null;
  paidBy: UserRef;
  addedBy: UserRef;
  receiptUrl: string | null;
  canEdit: boolean;
}

export interface ExpenseInput {
  title: string;
  amount: number;
  date: string;
  note: string | null;
  paidById?: string;
  receiptUrl: string | null;
}

export interface ExpenseQuery {
  q?: string;
  page?: number;
  limit?: number;
  categoryId?: string;
}
