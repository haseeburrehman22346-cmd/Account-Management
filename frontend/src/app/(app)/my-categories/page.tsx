"use client";

import { FolderOpenIcon } from "lucide-react";
import { CategoryCard } from "@/components/categories/category-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorAlert } from "@/components/shared/error-alert";
import { CardGridSkeleton } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/constants/routes";
import { useFetch } from "@/hooks/use-fetch";
import { categoriesService } from "@/services";

const listCategories = () => categoriesService.list();

export default function MyCategoriesPage() {
  // The API only returns categories assigned to the signed-in user.
  const { data: categories, error, isLoading } = useFetch(listCategories);

  return (
    <>
      <PageHeader title="My Categories" description="These are the categories assigned to you by admin." />
      <ErrorAlert message={error} />
      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : categories?.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="Nothing assigned yet"
          description="An admin hasn't assigned any categories to you."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories?.map((c) => (
            <CategoryCard key={c.id} category={c} href={ROUTES.user.category(c.id)} />
          ))}
        </div>
      )}
    </>
  );
}
