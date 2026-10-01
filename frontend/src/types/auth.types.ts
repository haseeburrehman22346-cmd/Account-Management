import type { Role, User } from "./user.types";

export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginResponse {
  token: string;
  role: Role;
  user: User;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
