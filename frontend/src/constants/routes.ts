import type { User } from "@/types";

export const ROUTES = {
  login: "/login",
  admin: {
    overview: "/admin",
    categories: "/admin/categories",
    category: (id: string) => `/admin/categories/${id}`,
    expenses: "/admin/expenses",
    users: "/admin/users",
    voice: "/admin/voice",
    chat: "/admin/chat",
    settings: "/admin/settings",
  },
  user: {
    categories: "/my-categories",
    category: (id: string) => `/my-categories/${id}`,
    profile: "/profile",
    voice: "/voice",
    chat: "/chat",
  },
} as const;

export const homeFor = (user: User) => (user.role === "admin" ? ROUTES.admin.overview : ROUTES.user.categories);

export const categoryHref = (user: User, id: string) =>
  user.role === "admin" ? ROUTES.admin.category(id) : ROUTES.user.category(id);

export const voiceHref = (user: User) => (user.role === "admin" ? ROUTES.admin.voice : ROUTES.user.voice);

export const profileHref = (user: User) => (user.role === "admin" ? ROUTES.admin.settings : ROUTES.user.profile);
