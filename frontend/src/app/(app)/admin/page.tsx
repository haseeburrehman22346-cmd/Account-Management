"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { CategoryBreakdownChart } from "@/components/dashboard/category-breakdown-chart";
import { MonthlyExpensesChart } from "@/components/dashboard/monthly-expenses-chart";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ErrorAlert } from "@/components/shared/error-alert";
import { TableSkeleton } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard, StatCardsSkeleton } from "@/components/shared/stat-card";
import { TableCard } from "@/components/shared/table-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useFetch } from "@/hooks/use-fetch";
import { formatMoney, plural } from "@/lib/format";
import { dashboardService } from "@/services";

export default function AdminOverviewPage() {
  const [months, setMonths] = useState(6);
  const fetchOverview = useCallback(() => dashboardService.overview(months), [months]);
  const { data, error, isLoading } = useFetch(fetchOverview);

  return (
    <>
      <PageHeader title="Overview" description="Your team's spending at a glance" />
      <ErrorAlert message={error} />

      {isLoading || !data ? (
        <>
          <StatCardsSkeleton />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
          <TableSkeleton />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Expenses" value={formatMoney(data.stats.totalSpent)} growthPct={data.stats.totalGrowthPct} hint="All time" />
            <StatCard
              label="Active Categories"
              value={data.stats.activeCategories}
              hint={`${plural(data.stats.assignedUsers, "user")} assigned`}
            />
            <StatCard
              label="Total Users"
              value={data.stats.totalUsers}
              hint={`${plural(data.stats.standardUsers, "standard user")}`}
            />
            <StatCard
              label="This Month"
              value={formatMoney(data.stats.thisMonthSpent)}
              growthPct={data.stats.thisMonthGrowthPct}
              hint="No spending last month to compare"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <MonthlyExpensesChart data={data.monthly} months={months} onMonthsChange={setMonths} />
            </div>
            <div>
              <CategoryBreakdownChart data={data.byCategory} />
            </div>
          </div>

          <TableCard
            title="Recent Expenses"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href={ROUTES.admin.expenses}>
                  View all <ArrowRightIcon />
                </Link>
              </Button>
            }
          >
            {data.recent.length ? (
              <ExpenseTable expenses={data.recent} columns={{ category: true, paidBy: true }} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No expenses recorded yet.</p>
            )}
          </TableCard>
        </>
      )}
    </>
  );
}
