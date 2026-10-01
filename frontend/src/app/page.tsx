"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageLoader } from "@/components/shared/loading-state";
import { homeFor, ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready) router.replace(user ? homeFor(user) : ROUTES.login);
  }, [ready, user, router]);

  return <FullPageLoader />;
}
