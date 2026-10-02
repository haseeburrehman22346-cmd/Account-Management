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

export type VoicePage = "overview" | "categories" | "expenses" | "users" | "settings" | "voice";

export interface VoiceNavigateAction {
  type: "navigate";
  page: VoicePage | "category";
  categoryId?: string;
  q?: string;
}

export interface VoiceConfirmDeleteAction {
  type: "confirm-delete";
  target: "category" | "expense" | "user";
  id: string;
  title: string;
  description: string;
}

export type VoiceAction =
  | { type: "none" | "back" | "logout" | "help" }
  | { type: "theme"; theme: "light" | "dark" | "system" }
  | VoiceNavigateAction
  | VoiceConfirmDeleteAction;

export interface VoiceCommandResult {
  transcript: string;
  /** False when the command wasn't understood or couldn't be carried out. */
  ok: boolean;
  message: string;
  action: VoiceAction;
  /** True when data was changed, so the open page should refetch. */
  changed: boolean;
  /** Set for add-expense and create-category sentences, with the parse to review. */
  entry: (({ kind: "expense" } & VoiceExpenseResult) | ({ kind: "category" } & VoiceCategoryResult)) | null;
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
