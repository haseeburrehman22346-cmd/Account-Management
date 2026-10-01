"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { CategoryAvatar } from "@/components/shared/category-avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryHref } from "@/constants/routes";
import { formatDate, formatMoney } from "@/lib/format";
import { expensesService } from "@/services";
import type { Expense, User } from "@/types";

/** Bell showing the latest expenses in the categories this user can see. */
export function NotificationsMenu({ user }: { user: User }) {
  const [items, setItems] = useState<Expense[] | null>(null);

  const load = useCallback(() => {
    expensesService.search({ limit: 6 }).then(
      (res) => setItems(res.items),
      () => setItems([]),
    );
  }, []);

  return (
    <Popover onOpenChange={(open) => open && load()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Recent activity">
          <BellIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Recent activity</p>
          <p className="text-xs text-muted-foreground">Latest expenses in your categories</p>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {items === null ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            items.map((e) => (
              <Link
                key={e.id}
                href={categoryHref(user, e.categoryId)}
                className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
              >
                <CategoryAvatar icon={e.category.icon} color={e.category.color} size="sm" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate">
                    <span className="font-medium">{e.paidBy.name}</span> · {e.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.category.name} · {formatDate(e.date)}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">{formatMoney(e.amount)}</span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
