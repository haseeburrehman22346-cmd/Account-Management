"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ROUTES } from "@/constants/routes";
import type { User } from "@/types";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";

export function TopBar({ user }: { user: User }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function search(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `${ROUTES.admin.expenses}?q=${encodeURIComponent(query)}` : ROUTES.admin.expenses);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      {user.role === "admin" && (
        <form onSubmit={search} className="relative hidden w-full max-w-md md:block" role="search">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search expenses by title, note or amount…"
            aria-label="Search expenses"
            className="h-9 bg-muted/60 pl-9"
          />
        </form>
      )}

      <div className="ml-auto flex items-center gap-1">
        <NotificationsMenu user={user} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
