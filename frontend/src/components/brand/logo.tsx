import { WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground",
        className,
      )}
    >
      <WalletIcon className="size-4" />
    </span>
  );
}

/** Two-line wordmark: "MONEY" over a green "MANAGER". */
export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!collapsed && (
        <span className="flex flex-col text-[0.8rem] leading-tight font-bold tracking-wide uppercase">
          <span>Money</span>
          <span className="text-sidebar-primary">Manager</span>
        </span>
      )}
    </span>
  );
}
