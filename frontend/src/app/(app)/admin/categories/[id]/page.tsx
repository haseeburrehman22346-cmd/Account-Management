"use client";

import {
  CalendarIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  ReceiptIcon,
  Trash2Icon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BudgetStatCard, RemainingBudget } from "@/components/categories/budget-stats";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { CategoryMembersTable } from "@/components/categories/category-members-table";
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
import { StatusBadge } from "@/components/shared/status-badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { useExpenseList } from "@/hooks/use-expense-list";
import { useFetch } from "@/hooks/use-fetch";
import { formatMoney, plural } from "@/lib/format";
import { categoriesService, expensesService, usersService } from "@/services";
import type { Expense } from "@/types";

const listUsers = () => usersService.list();

export default function AdminCategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuth();

  const fetchCategory = useCallback(() => categoriesService.get(id), [id]);
  const category = useFetch(fetchCategory);
  const fetchMembers = useCallback(() => categoriesService.members(id), [id]);
  const members = useFetch(fetchMembers);
  const users = useFetch(listUsers);
  const list = useExpenseList({ categoryId: id });

  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense>();
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const payers = useMemo(
    () => (users.data ?? []).filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })),
    [users.data],
  );

  const refreshAll = () => {
    category.reload();
    members.reload();
    list.reload();
  };

  const openExpenseForm = (expense?: Expense) => {
    setEditingExpense(expense);
    setExpenseFormOpen(true);
  };

  if (category.status === 404 || category.status === 400) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="Category not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" asChild>
            <Link href={ROUTES.admin.categories}>Back to categories</Link>
          </Button>
        }
      />
    );
  }

  const c = category.data;

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={ROUTES.admin.categories}>Categories</Link>
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
        <StatCardsSkeleton count={3} className="lg:grid-cols-3 xl:grid-cols-3" />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <CategoryAvatar icon={c.icon} color={c.color} size="lg" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
                  <StatusBadge active={c.status === "active"} />
                </div>
                <p className="text-sm text-muted-foreground">{c.description || "No description"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setCategoryFormOpen(true)}>
                <PencilIcon /> Edit Category
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreVerticalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteCategoryOpen(true)}>
                    <Trash2Icon /> Delete category
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Full width on tablets so the other two cards pair up below it. */}
            <div className="sm:col-span-2 lg:col-span-1">
              <StatCard
                icon={WalletIcon}
                label="Total Expenses"
                value={formatMoney(c.totalSpent)}
                growthPct={c.totalGrowthPct}
                hint="All time"
                footer={<RemainingBudget category={c} />}
              />
            </div>
            <StatCard
              icon={CalendarIcon}
              label="This Month"
              value={formatMoney(c.thisMonthSpent)}
              growthPct={c.thisMonthGrowthPct}
              hint="No spending last month"
            />
            <BudgetStatCard category={c} onSetBudget={() => setCategoryFormOpen(true)} />
          </div>
        </>
      )}

      <Tabs defaultValue="expenses" className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="expenses">
              <ReceiptIcon /> Expenses
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon /> Assigned Users
            </TabsTrigger>
          </TabsList>
          {c && (
            <Button onClick={() => openExpenseForm()}>
              <PlusIcon /> Add Expense
            </Button>
          )}
        </div>

        <TabsContent value="expenses">
          <TableCard
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
                columns={{ paidBy: true }}
                actions={{ onEdit: openExpenseForm, onDelete: setDeletingExpense }}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {list.query ? "No expenses match your search." : "No expenses yet."}
              </p>
            )}
          </TableCard>
        </TabsContent>

        <TabsContent value="users">
          <TableCard>
            {members.data?.length ? (
              <CategoryMembersTable members={members.data} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {members.isLoading ? "Loading…" : "No users assigned. Use Edit Category to assign some."}
              </p>
            )}
          </TableCard>
        </TabsContent>
      </Tabs>

      {c && (
        <>
          <CategoryFormDialog
            open={categoryFormOpen}
            onOpenChange={setCategoryFormOpen}
            category={c}
            onSaved={() => {
              setCategoryFormOpen(false);
              refreshAll();
            }}
          />
          <ExpenseFormDialog
            open={expenseFormOpen}
            onOpenChange={setExpenseFormOpen}
            categoryId={c.id}
            categories={[c]}
            payers={payers}
            defaultPayerId={me?.id}
            withReceipt
            expense={editingExpense}
            onSaved={() => {
              setExpenseFormOpen(false);
              refreshAll();
            }}
          />
          <ConfirmDialog
            open={deleteCategoryOpen}
            onOpenChange={setDeleteCategoryOpen}
            title={`Delete "${c.name}"?`}
            description={`This also deletes its ${plural(c.expenseCount, "expense")} and their receipts. This can't be undone.`}
            onConfirm={async () => {
              await categoriesService.remove(c.id);
              toast.success("Category deleted");
              router.replace(ROUTES.admin.categories);
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={deletingExpense !== null}
        onOpenChange={(open) => !open && setDeletingExpense(null)}
        title={`Delete "${deletingExpense?.title}"?`}
        description="This expense will be removed from the category total."
        onConfirm={async () => {
          await expensesService.remove(deletingExpense!.id);
          toast.success("Expense deleted");
          refreshAll();
        }}
      />
    </>
  );
}
