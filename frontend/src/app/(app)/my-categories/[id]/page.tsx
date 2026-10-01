"use client";

import { BarChart3Icon, ChevronLeftIcon, ListIcon, PlusIcon, ReceiptIcon, WalletIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { CategoryAvatar } from "@/components/shared/category-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorAlert } from "@/components/shared/error-alert";
import { TableSkeleton } from "@/components/shared/loading-state";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard, StatCardsSkeleton } from "@/components/shared/stat-card";
import { TableCard } from "@/components/shared/table-card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { useExpenseList } from "@/hooks/use-expense-list";
import { useFetch } from "@/hooks/use-fetch";
import { formatMoney } from "@/lib/format";
import { categoriesService, expensesService } from "@/services";
import type { Expense } from "@/types";

export default function MyCategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetchCategory = useCallback(() => categoriesService.get(id), [id]);
  const category = useFetch(fetchCategory);
  const list = useExpenseList({ categoryId: id, limit: 5 });

  const [panelOpen, setPanelOpen] = useState(true);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const refresh = () => {
    category.reload();
    list.reload();
  };

  if (category.status === 404 || category.status === 400) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="Category not found"
        description="It doesn't exist or isn't assigned to you."
        action={
          <Button variant="outline" asChild>
            <Link href={ROUTES.user.categories}>Back to My Categories</Link>
          </Button>
        }
      />
    );
  }

  const c = category.data;
  const showPanel = !!c?.canAddExpense && panelOpen;

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={ROUTES.user.categories} className="flex items-center gap-1">
                <ChevronLeftIcon className="size-3.5" /> My Categories
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{c?.name ?? "…"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <ErrorAlert message={category.error} />

      {!c ? (
        <StatCardsSkeleton count={3} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <CategoryAvatar icon={c.icon} color={c.color} size="lg" shape="circle" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {c.description || `Manage and track your ${c.name.toLowerCase()} expenses`}
                </p>
              </div>
            </div>
            {c.canAddExpense && !panelOpen && (
              <Button onClick={() => setPanelOpen(true)}>
                <PlusIcon /> Add Expense
              </Button>
            )}
          </div>

          {c.status === "inactive" && (
            <p className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              This category is inactive — new expenses can&apos;t be added right now.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={WalletIcon} label="Total Expenses" value={formatMoney(c.thisMonthSpent)} hint="This month" />
            <StatCard icon={ListIcon} label="No. of Expenses" value={c.thisMonthCount} hint="This month" />
            <StatCard icon={BarChart3Icon} label="Average Expense" value={formatMoney(c.thisMonthAverage)} hint="This month" />
          </div>
        </>
      )}

      <div className={showPanel ? "grid items-start gap-4 xl:grid-cols-[1fr_20rem]" : ""}>
        <TableCard
          title="Expenses"
          actions={<SearchInput value={list.query} onChange={list.setQuery} placeholder="Search by title, notes or amount…" />}
          footer={
            list.data && (
              <DataPagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                total={list.data.total}
                limit={list.limit}
                onPageChange={list.setPage}
              />
            )
          }
        >
          <ErrorAlert message={list.error} />
          {list.isLoading ? (
            <div className="p-4">
              <TableSkeleton />
            </div>
          ) : list.data?.items.length ? (
            <ExpenseTable
              expenses={list.data.items}
              columns={{ notes: true, titleLabel: "Title" }}
              actions={{ onEdit: setEditing, onDelete: setDeleting }}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {list.query ? "No expenses match your search." : "No expenses yet — add the first one."}
            </p>
          )}
        </TableCard>

        {showPanel && c && (
          <Card className="xl:sticky xl:top-20">
            <CardHeader>
              <CardTitle>Add New Expense</CardTitle>
              <CardAction>
                <Button variant="ghost" size="icon-sm" onClick={() => setPanelOpen(false)} aria-label="Close panel">
                  <XIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ExpenseForm categoryId={c.id} layout="panel" titleLabel="Title" onSaved={refresh} />
            </CardContent>
          </Card>
        )}
      </div>

      {c && (
        <ExpenseFormDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          categoryId={c.id}
          titleLabel="Title"
          expense={editing ?? undefined}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title}"?`}
        description="This expense will be removed from the category total."
        onConfirm={async () => {
          await expensesService.remove(deleting!.id);
          toast.success("Expense deleted");
          refresh();
        }}
      />
    </>
  );
}
