import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { CategoryAvatar } from "@/components/shared/category-avatar";
import { formatMoney } from "@/lib/format";
import type { Category } from "@/types";

/** User-facing category tile: icon, name, description and this month's spend. */
export function CategoryCard({ category, href }: { category: Category; href: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between">
        <CategoryAvatar icon={category.icon} color={category.color} size="lg" shape="circle" />
        <ChevronRightIcon className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{category.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {category.description || `Track your ${category.name.toLowerCase()} expenses`}
        </p>
      </div>
      <p className="mt-auto border-t pt-3 text-xs text-muted-foreground">
        This month <span className="font-semibold text-foreground tabular-nums">{formatMoney(category.thisMonthSpent)}</span>
        {category.status === "inactive" && <span className="ml-2">· Inactive</span>}
      </p>
    </Link>
  );
}
