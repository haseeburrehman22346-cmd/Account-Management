"use client";

import { ArrowDownRightIcon, ArrowUpRightIcon, EyeIcon, MoreVerticalIcon, PencilIcon, ReceiptIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { CategoryAvatar } from "@/components/shared/category-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROUTES } from "@/constants/routes";
import { formatMoney, formatPct, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

const MAX_AVATARS = 4;

export function AdminCategoryCard({
  category: c,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const href = ROUTES.admin.category(c.id);
  const budgetPct = c.budgetLimit ? Math.min(100, (c.thisMonthSpent / c.budgetLimit) * 100) : null;
  const overBudget = c.budgetLimit != null && c.thisMonthSpent > c.budgetLimit;
  const growth = c.thisMonthGrowthPct;
  const extraUsers = c.assignedUsers.length - MAX_AVATARS;

  return (
    <div className="relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md">
      {/* Whole-card link sits under the interactive bits, which are raised with z-10. */}
      <Link href={href} className="absolute inset-0 rounded-xl" aria-label={`Open ${c.name}`} />

      <div className="flex items-start gap-3">
        <CategoryAvatar icon={c.icon} color={c.color} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{c.name}</h3>
          <StatusBadge active={c.status === "active"} className="mt-1" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative z-10 -mr-2" aria-label={`Actions for ${c.name}`}>
              <MoreVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={href}>
                <EyeIcon /> View expenses
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(c)}>
              <PencilIcon /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(c)}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{c.description || "No description"}</p>

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="truncate font-semibold tabular-nums">{formatMoney(c.totalSpent)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="truncate font-semibold tabular-nums">{formatMoney(c.thisMonthSpent)}</p>
          {growth !== null && (
            <p className={cn("flex items-center gap-0.5 text-xs", growth >= 0 ? "text-primary" : "text-muted-foreground")}>
              {growth >= 0 ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
              {formatPct(growth)}
            </p>
          )}
        </div>
      </div>

      {budgetPct !== null && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Monthly budget</span>
            <span className={cn("font-medium tabular-nums", overBudget && "text-destructive")}>
              {Math.round((c.thisMonthSpent / c.budgetLimit!) * 100)}% of {formatMoney(c.budgetLimit!)}
            </span>
          </div>
          <Progress value={budgetPct} className={cn(overBudget && "*:data-[slot=progress-indicator]:bg-destructive")} />
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
          <ReceiptIcon className="size-4" />
          {plural(c.expenseCount, "expense")}
        </span>

        {c.assignedUsers.length ? (
          <Tooltip>
            <TooltipTrigger className="relative z-10 cursor-default" aria-label={`Assigned to ${plural(c.assignedUsers.length, "user")}`}>
              <AvatarGroup className="-space-x-1">
                {c.assignedUsers.slice(0, MAX_AVATARS).map((u) => (
                  <UserAvatar key={u.id} name={u.name} className="text-xs" />
                ))}
                {extraUsers > 0 && <AvatarGroupCount className="text-xs">+{extraUsers}</AvatarGroupCount>}
              </AvatarGroup>
            </TooltipTrigger>
            <TooltipContent>{c.assignedUsers.map((u) => u.name).join(", ")}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </div>
    </div>
  );
}
