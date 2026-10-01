import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  growthPct,
  icon: Icon,
  valueClassName,
  iconClassName,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  /** Secondary line, used when there is no growth figure. */
  hint?: React.ReactNode;
  /** Change vs last month; null means there was nothing to compare against. */
  growthPct?: number | null;
  icon?: LucideIcon;
  valueClassName?: string;
  iconClassName?: string;
  /** Extra content under the figures, e.g. a progress bar or action. */
  footer?: React.ReactNode;
}) {
  const hasGrowth = growthPct !== undefined && growthPct !== null;
  const up = hasGrowth && growthPct >= 0;

  return (
    <Card className="h-full gap-0">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground",
                iconClassName,
              )}
            >
              <Icon className="size-5" />
            </span>
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
              className={cn(
                "truncate text-2xl font-semibold tracking-tight tabular-nums",
                valueClassName,
              )}
            >
              {value}
            </p>
            {hasGrowth ? (
              <p
                className={cn(
                  "flex items-center gap-1 text-xs",
                  up ? "text-primary" : "text-muted-foreground",
                )}
              >
                {up ? (
                  <ArrowUpRightIcon className="size-3.5" />
                ) : (
                  <ArrowDownRightIcon className="size-3.5" />
                )}
                <span className="font-medium">{formatPct(growthPct)}</span>
                <span className="text-muted-foreground">from last month</span>
              </p>
            ) : (
              hint && <p className="text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
        </div>
        {footer && <div className="mt-auto">{footer}</div>}
      </CardContent>
    </Card>
  );
}

export function StatCardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
