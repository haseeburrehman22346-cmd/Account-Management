import type { ManagedUser, User, UserInput } from "@/types";
import { apiClient } from "./api-client";

export const usersService = {
  list: (q?: string) => apiClient.get<ManagedUser[]>("/users", { q }),
  create: (input: UserInput) => apiClient.post<User>("/users", input),
  update: (id: string, input: UserInput) => apiClient.put<User>(`/users/${id}`, input),
  remove: (id: string) => apiClient.delete(`/users/${id}`),
};
