import {
  FolderIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  MicIcon,
  ReceiptIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import type { Role } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match nested routes too, e.g. /admin/categories/123 */
  matchPrefix?: boolean;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  admin: [
    { href: ROUTES.admin.overview, label: "Overview", icon: LayoutDashboardIcon },
    { href: ROUTES.admin.categories, label: "Categories", icon: FolderIcon, matchPrefix: true },
    { href: ROUTES.admin.expenses, label: "Expenses", icon: ReceiptIcon },
    { href: ROUTES.admin.voice, label: "Voice Entry", icon: MicIcon },
    { href: ROUTES.admin.users, label: "Users", icon: UsersIcon },
    { href: ROUTES.admin.settings, label: "Settings", icon: SettingsIcon },
  ],
  user: [
    { href: ROUTES.user.categories, label: "My Categories", icon: LayoutGridIcon, matchPrefix: true },
    { href: ROUTES.user.voice, label: "Voice Entry", icon: MicIcon },
    { href: ROUTES.user.profile, label: "My Profile", icon: UserIcon },
  ],
};

export const isNavActive = (item: NavItem, pathname: string) =>
  pathname === item.href || (!!item.matchPrefix && pathname.startsWith(`${item.href}/`));
