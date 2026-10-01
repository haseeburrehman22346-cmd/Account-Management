import type { Category } from "./category.types";
import type { Expense, ExpenseCategoryRef } from "./expense.types";
import type { UserRef } from "./user.types";

export interface VoiceParseResult {
  transcript: string;
  category: ExpenseCategoryRef | null;
  alternatives: ExpenseCategoryRef[];
  amount: number | null;
  title: string;
  date: string;
  missing: ("category" | "amount")[];
}

export interface VoiceCategoryParse {
  transcript: string;
  name: string;
  budget: number | null;
  icon: string;
  color: string;
  users: UserRef[];
  /** An existing category with the same name; nothing is created in that case. */
  duplicate: Category | null;
  missing: "name"[];
}

export interface VoiceCategoryResult {
  parsed: VoiceCategoryParse;
  category: Category | null;
}

export interface VoiceExpenseResult {
  parsed: VoiceParseResult;
  /** Null when the sentence was missing a category or amount. */
  expense: Expense | null;
}

export interface CategoryImageLine {
  name: string;
  budget: number | null;
  icon: string;
  color: string;
  /** An existing category with the same name. */
  duplicate: Category | null;
}

export interface CategoryImageResult {
  categories: CategoryImageLine[];
}

export interface ReceiptLine {
  title: string;
  amount: number;
}

export interface ReceiptReadResult {
  receiptUrl: string;
  title: string;
  /** ISO date, YYYY-MM-DD; today when the receipt has none. */
  date: string;
  total: number | null;
  category: ExpenseCategoryRef | null;
  items: ReceiptLine[];
}
