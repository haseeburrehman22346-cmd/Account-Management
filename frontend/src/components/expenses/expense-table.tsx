import { MoreHorizontalIcon, PaperclipIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { CategoryAvatar } from "@/components/shared/category-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate, formatMoney } from "@/lib/format";
import { assetUrl } from "@/services";
import type { Expense } from "@/types";

export interface ExpenseRowActions {
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

export interface ExpenseColumns {
  category?: boolean;
  paidBy?: boolean;
  notes?: boolean;
  /** Label for the title column: "Description" (admin) or "Title" (user). */
  titleLabel?: string;
}

export function ExpenseTable({
  expenses,
  columns = {},
  actions,
}: {
  expenses: Expense[];
  columns?: ExpenseColumns;
  actions?: ExpenseRowActions;
}) {
  const { category, paidBy, notes, titleLabel = "Description" } = columns;

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className="w-32">Date</TableHead>
          <TableHead>{titleLabel}</TableHead>
          {category && <TableHead>Category</TableHead>}
          {paidBy && <TableHead>Paid By</TableHead>}
          <TableHead className="text-right">{notes ? "Amount (PKR)" : "Amount"}</TableHead>
          {notes && <TableHead>Notes</TableHead>}
          {actions && <TableHead className="w-14 text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((e) => (
          <TableRow key={e.id} className="h-12">
            <TableCell className="text-muted-foreground tabular-nums">{formatDate(e.date)}</TableCell>
            <TableCell className="max-w-64 whitespace-normal">
              <span className="flex items-center gap-1.5 font-medium">
                {e.title}
                {e.receiptUrl && (
                  <a
                    href={assetUrl(e.receiptUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    aria-label={`View receipt for ${e.title}`}
                    title="View receipt"
                  >
                    <PaperclipIcon className="size-3.5" />
                  </a>
                )}
              </span>
              {!notes && e.note && <span className="block text-xs text-muted-foreground">{e.note}</span>}
            </TableCell>
            {category && (
              <TableCell>
                <span className="flex items-center gap-2">
                  <CategoryAvatar icon={e.category.icon} color={e.category.color} size="sm" className="size-6" />
                  {e.category.name}
                </span>
              </TableCell>
            )}
            {paidBy && <TableCell>{e.paidBy.name}</TableCell>}
            <TableCell className="text-right font-medium tabular-nums">
              {notes ? formatAmount(e.amount) : formatMoney(e.amount)}
            </TableCell>
            {notes && <TableCell className="max-w-48 truncate text-muted-foreground">{e.note ?? "—"}</TableCell>}
            {actions && (
              <TableCell className="text-right">
                {e.canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.title}`}>
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => actions.onEdit(e)}>
                        <PencilIcon /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(e)}>
                        <Trash2Icon /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
