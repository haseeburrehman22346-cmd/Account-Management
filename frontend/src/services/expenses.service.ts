import type { Expense, ExpenseInput, ExpenseQuery, Paginated } from "@/types";
import { apiClient } from "./api-client";

export const expensesService = {
  search: ({ categoryId, ...query }: ExpenseQuery) =>
    categoryId
      ? apiClient.get<Paginated<Expense>>(`/categories/${categoryId}/expenses`, { ...query })
      : apiClient.get<Paginated<Expense>>("/expenses", { ...query }),
  create: (categoryId: string, input: ExpenseInput) =>
    apiClient.post<Expense>(`/categories/${categoryId}/expenses`, input),
  update: (id: string, input: ExpenseInput) => apiClient.put<Expense>(`/expenses/${id}`, input),
  remove: (id: string) => apiClient.delete(`/expenses/${id}`),
};
