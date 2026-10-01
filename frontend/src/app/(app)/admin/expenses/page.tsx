"use client";

import { PlusIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { ErrorAlert } from "@/components/shared/error-alert";
import { TableSkeleton } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { TableCard } from "@/components/shared/table-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useExpenseList } from "@/hooks/use-expense-list";
import { useFetch } from "@/hooks/use-fetch";
import { categoriesService, expensesService, usersService } from "@/services";
import type { Expense } from "@/types";

const ALL = "all";
const listCategories = () => categoriesService.list();
const listUsers = () => usersService.list();

export default function AdminExpensesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ExpensesFromUrl />
    </Suspense>
  );
}

/** Remounts when the top-bar search changes ?q, so the new query is picked up. */
function ExpensesFromUrl() {
  const q = useSearchParams().get("q") ?? "";
  return <AdminExpenses key={q} initialQuery={q} />;
}

function AdminExpenses({ initialQuery }: { initialQuery: string }) {
  const { user: me } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const list = useExpenseList({ categoryId: categoryFilter === ALL ? undefined : categoryFilter, initialQuery });
  const categories = useFetch(listCategories);
  const users = useFetch(listUsers);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense>();
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const payers = useMemo(
    () => (users.data ?? []).filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })),
    [users.data],
  );

  const openForm = (expense?: Expense) => {
    setEditing(expense);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Every expense across all categories"
        actions={
          <Button onClick={() => openForm()} disabled={!categories.data?.length}>
            <PlusIcon /> Add Expense
          </Button>
        }
      />

      <TableCard
        title={list.data ? `${list.data.total} expense${list.data.total === 1 ? "" : "s"}` : "Expenses"}
        actions={
          <>
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                list.setPage(1);
              }}
            >
              <SelectTrigger className="w-44" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput value={list.query} onChange={list.setQuery} placeholder="Search by title, notes or amount…" />
          </>
        }
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
            columns={{ category: true, paidBy: true }}
            actions={{ onEdit: openForm, onDelete: setDeleting }}
          />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {list.query ? "No expenses match your search." : "No expenses yet."}
          </p>
        )}
      </TableCard>

      {categories.data && categories.data.length > 0 && (
        <ExpenseFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          categoryId={categoryFilter === ALL ? categories.data[0].id : categoryFilter}
          categories={categories.data}
          payers={payers}
          defaultPayerId={me?.id}
          withReceipt
          expense={editing}
          onSaved={() => {
            setFormOpen(false);
            list.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title}"?`}
        description="This expense will be removed from its category total."
        onConfirm={async () => {
          await expensesService.remove(deleting!.id);
          toast.success("Expense deleted");
          list.reload();
        }}
      />
    </>
  );
}
