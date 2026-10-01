import { CircleAlertIcon, PiggyBankIcon, TargetIcon } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatMoney, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

/** Days left in the current month, including today. */
function daysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
}

/** "Monthly Budget" card; the budget resets each month. */
export function BudgetStatCard({ category, onSetBudget }: { category: Category; onSetBudget?: () => void }) {
  const budget = category.budgetLimit;

  if (!budget) {
    return (
      <StatCard
        icon={TargetIcon}
        label="Monthly Budget"
        value="Not set"
        valueClassName="text-muted-foreground"
        hint="Add a limit to track spending"
        footer={
          onSetBudget && (
            <Button variant="outline" size="sm" onClick={onSetBudget}>
              Set budget
            </Button>
          )
        }
      />
    );
  }

  const usedPct = Math.round((category.thisMonthSpent / budget) * 100);
  const over = category.thisMonthSpent > budget;

  return (
    <StatCard
      icon={TargetIcon}
      label="Monthly Budget"
      value={formatMoney(budget)}
      hint={`${usedPct}% used this month`}
      footer={
        <Progress
          value={Math.min(100, usedPct)}
          aria-label={`${usedPct}% of budget used`}
          className={cn(
            "h-1.5",
            over && "*:data-[slot=progress-indicator]:bg-destructive",
            !over && usedPct >= 80 && "*:data-[slot=progress-indicator]:bg-amber-500",
          )}
        />
      }
    />
  );
}

/** Budget left this month, shown under the Total Expenses figure. */
export function RemainingBudget({ category }: { category: Category }) {
  const budget = category.budgetLimit;

  if (!budget) {
    return (
      <p className="border-t pt-3 text-xs text-muted-foreground">
        Set a monthly budget to see what&apos;s remaining.
      </p>
    );
  }

  const remaining = budget - category.thisMonthSpent;
  const over = remaining < 0;
  const days = daysLeftInMonth();

  return (
    <div className="flex items-center justify-between gap-3 border-t pt-3">
      <span className={cn("flex items-center gap-1.5 text-xs", over ? "text-destructive" : "text-muted-foreground")}>
        {over ? <CircleAlertIcon className="size-3.5" /> : <PiggyBankIcon className="size-3.5" />}
        {over ? "Over budget by" : "Remaining this month"}
      </span>
      <span className="text-right">
        <span className={cn("block text-sm font-semibold tabular-nums", over && "text-destructive")}>
          {formatMoney(Math.abs(remaining))}
        </span>
        {!over && <span className="block text-xs text-muted-foreground">{plural(days, "day")} left</span>}
      </span>
    </div>
  );
}
