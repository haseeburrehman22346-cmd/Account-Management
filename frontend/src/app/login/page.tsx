"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { LoginHero } from "@/components/auth/login-hero";
import { Logo } from "@/components/brand/logo";
import { homeFor } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace(homeFor(user));
  }, [ready, user, router]);

  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-[1.1fr_1fr]">
      <LoginHero />
      <section className="flex flex-col items-center justify-center gap-10 bg-background p-6">
        <Logo className="text-foreground lg:hidden" />
        <LoginForm />
      </section>
    </main>
  );
}
