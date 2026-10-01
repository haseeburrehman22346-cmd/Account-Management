import type { Category, CategoryInput, CategoryMember } from "@/types";
import { apiClient } from "./api-client";

export const categoriesService = {
  list: (q?: string) => apiClient.get<Category[]>("/categories", { q }),
  get: (id: string) => apiClient.get<Category>(`/categories/${id}`),
  members: (id: string) => apiClient.get<CategoryMember[]>(`/categories/${id}/users`),
  create: (input: CategoryInput) => apiClient.post<Category>("/categories", input),
  update: (id: string, input: CategoryInput) => apiClient.put<Category>(`/categories/${id}`, input),
  remove: (id: string) => apiClient.delete(`/categories/${id}`),
};
