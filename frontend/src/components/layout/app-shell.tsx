"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FullPageLoader } from "@/components/shared/loading-state";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { homeFor, ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

/** Signed-in shell. Handles navigation only; the API enforces access control. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dataVersion, setDataVersion] = useState(0);
  const refreshPage = useCallback(() => setDataVersion((v) => v + 1), []);

  const wrongArea =
    !!user &&
    ((user.role !== "admin" && pathname.startsWith("/admin")) ||
      (user.role === "admin" &&
        (pathname.startsWith(ROUTES.user.categories) || pathname === ROUTES.user.profile || pathname === ROUTES.user.voice)));

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(ROUTES.login);
    else if (wrongArea) router.replace(homeFor(user));
  }, [ready, user, wrongArea, router]);

  if (!ready || !user || wrongArea) return <FullPageLoader />;

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0 bg-background">
        <TopBar user={user} onDataChanged={refreshPage} />
        {/* Remounting the page makes it refetch after a voice command changed data. */}
        <main key={dataVersion} className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
