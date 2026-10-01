import type { ChangePasswordInput, LoginInput, LoginResponse, User } from "@/types";
import { apiClient } from "./api-client";

export const authService = {
  login: (input: LoginInput) => apiClient.post<LoginResponse>("/auth/login", input),
  logout: () => apiClient.post<void>("/auth/logout", {}),
  me: () => apiClient.get<User>("/auth/me"),
  updateProfile: (name: string) => apiClient.put<User>("/auth/me", { name }),
  changePassword: (input: ChangePasswordInput) => apiClient.put<void>("/auth/me/password", input),
};
