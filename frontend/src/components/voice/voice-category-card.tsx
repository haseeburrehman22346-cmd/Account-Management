"use client";

import { CheckCircle2Icon, CircleAlertIcon, ExternalLinkIcon, PencilIcon, Undo2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { CategoryAvatar } from "@/components/shared/category-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, VoiceCategoryParse } from "@/types";
import type { VoiceItemStatus } from "./voice-result-card";

export interface CategoryVoiceItem {
  kind: "category";
  id: number;
  parsed: VoiceCategoryParse;
  category: Category | null;
  status: VoiceItemStatus;
}

export function VoiceCategoryCard({
  item,
  busy,
  onUndo,
  onEdit,
  onComplete,
  onDismiss,
}: {
  item: CategoryVoiceItem;
  busy?: boolean;
  onUndo: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const { parsed, category, status } = item;
  const dismiss = (
    <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Remove from list" title="Remove">
      <XIcon />
    </Button>
  );

  if (status === "saved" && category) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <CategoryAvatar icon={category.icon} color={category.color} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {category.name}
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2Icon className="size-3 text-primary" /> Category created
            </Badge>
          </p>
          <p className="text-sm text-muted-foreground">
            {category.budgetLimit ? `Budget ${formatMoney(category.budgetLimit)}/month` : "No budget"} ·{" "}
            {category.assignedUsers.length
              ? `Assigned to ${category.assignedUsers.map((u) => u.name).join(", ")}`
              : "Not assigned yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.admin.category(category.id)}>
              <ExternalLinkIcon /> Open
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
            <PencilIcon /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onUndo} disabled={busy}>
            <Undo2Icon /> Undo
          </Button>
        </div>
      </div>
    );
  }

  if (status === "undone") {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4 opacity-60">
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">Category removed: “{parsed.transcript}”</p>
        {dismiss}
      </div>
    );
  }

  const duplicate = parsed.duplicate;
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-card p-4 sm:flex-row sm:items-center")}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
        <CircleAlertIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          {duplicate ? `“${duplicate.name}” already exists` : "I couldn't catch the category name"}
        </p>
        <p className="truncate text-xs text-muted-foreground">Heard: “{parsed.transcript}”</p>
        {!duplicate && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="outline">Budget: {parsed.budget !== null ? formatMoney(parsed.budget) : "—"}</Badge>
            {parsed.users.length > 0 && <Badge variant="outline">Users: {parsed.users.map((u) => u.name).join(", ")}</Badge>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {duplicate ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={ROUTES.admin.category(duplicate.id)}>
              <ExternalLinkIcon /> Open {duplicate.name}
            </Link>
          </Button>
        ) : (
          <Button size="sm" onClick={onComplete}>
            Complete &amp; save
          </Button>
        )}
        {dismiss}
      </div>
    </div>
  );
}
