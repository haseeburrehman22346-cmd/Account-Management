"use client";

import { FolderPlusIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AdminCategoryCard } from "@/components/categories/admin-category-card";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorAlert } from "@/components/shared/error-alert";
import { CardGridSkeleton } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFetch } from "@/hooks/use-fetch";
import { categoriesService } from "@/services";
import type { Category } from "@/types";

export default function AdminCategoriesPage() {
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim());
  const fetcher = useCallback(() => categoriesService.list(q), [q]);
  const { data: categories, error, isLoading, reload } = useFetch(fetcher);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category>();
  const [deleting, setDeleting] = useState<Category | null>(null);

  const openForm = (category?: Category) => {
    setEditing(category);
    setFormOpen(true);
  };

  const addButton = (
    <Button onClick={() => openForm()}>
      <PlusIcon /> Add Category
    </Button>
  );

  return (
    <>
      <PageHeader
        title={`Categories${categories ? ` (${categories.length})` : ""}`}
        description="Create and manage expense categories"
        actions={addButton}
      />

      <SearchInput value={query} onChange={setQuery} placeholder="Search categories…" className="sm:w-80" />
      <ErrorAlert message={error} />

      {isLoading ? (
        <CardGridSkeleton count={8} />
      ) : categories?.length ? (
        <div className="@container">
          <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4">
            {categories.map((c) => (
              <AdminCategoryCard key={c.id} category={c} onEdit={openForm} onDelete={setDeleting} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={FolderPlusIcon}
          title={q ? "No matching categories" : "No categories yet"}
          description={q ? "Try a different search." : "Create a category and assign it to users."}
          action={!q && addButton}
        />
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description={`This also deletes its ${deleting?.expenseCount ?? 0} expense(s) and their receipts. This can't be undone.`}
        onConfirm={async () => {
          await categoriesService.remove(deleting!.id);
          toast.success("Category deleted");
          reload();
        }}
      />
    </>
  );
}
