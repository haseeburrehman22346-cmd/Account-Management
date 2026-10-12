"use client";

import { CheckCircle2Icon, CircleAlertIcon, PencilIcon, Undo2Icon, XIcon } from "lucide-react";
import { CategoryAvatar } from "@/components/shared/category-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Expense, VoiceParseResult } from "@/types";

export type VoiceItemStatus = "saved" | "needs-review" | "undone";

export interface VoiceItem {
  kind: "expense";
  id: number;
  parsed: VoiceParseResult;
  expense: Expense | null;
  status: VoiceItemStatus;
  /** Receipt attached when the entry was made; carried into the review form if nothing was saved. */
  receiptUrl?: string | null;
}

const MISSING_TEXT = {
  category: "I couldn't match a category",
  amount: "I couldn't catch the amount",
};

export function VoiceResultCard({
  item,
  busy,
  onUndo,
  onEdit,
  onComplete,
  onDismiss,
}: {
  item: VoiceItem;
  busy?: boolean;
  onUndo: () => void;
  onEdit: () => void;
  onComplete: () => void;
  /** Removes the card from the list; nothing is deleted on the server. */
  onDismiss: () => void;
}) {
  const { parsed, expense, status } = item;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center",
        status === "needs-review" && "border-amber-500/40",
        status === "undone" && "opacity-60",
      )}
    >
      {status === "saved" && expense ? (
        <>
          <CategoryAvatar icon={expense.category.icon} color={expense.category.color} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {expense.title}
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2Icon className="size-3 text-primary" /> Saved
              </Badge>
            </p>
            <p className="text-sm text-muted-foreground">
              {expense.category.name} · {formatDate(expense.date)}
            </p>
          </div>
          <p className="text-lg font-semibold tabular-nums">{formatMoney(expense.amount)}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
              <PencilIcon /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onUndo} disabled={busy}>
              <Undo2Icon /> Undo
            </Button>
          </div>
        </>
      ) : status === "undone" ? (
        <>
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">Removed: “{parsed.transcript}”</p>
          <DismissButton onClick={onDismiss} />
        </>
      ) : (
        <>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
            <CircleAlertIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{parsed.missing.map((m) => MISSING_TEXT[m]).join(" and ")}</p>
            <p className="truncate text-xs text-muted-foreground">Heard: “{parsed.transcript}”</p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="outline">Category: {parsed.category?.name ?? "—"}</Badge>
              <Badge variant="outline">Amount: {parsed.amount !== null ? formatMoney(parsed.amount) : "—"}</Badge>
              {parsed.title && <Badge variant="outline">Title: {parsed.title}</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onComplete}>
              Complete &amp; save
            </Button>
            <DismissButton onClick={onDismiss} />
          </div>
        </>
      )}
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label="Remove from list" title="Remove">
      <XIcon />
    </Button>
  );
}
