import type { Role } from "@/types";

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
];
