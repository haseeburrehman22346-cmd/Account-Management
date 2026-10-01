"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Expense } from "@/types";
import { ExpenseForm, type ExpenseFormProps } from "./expense-form";

/** Add (no `expense`) or edit an expense in a modal. */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  onSaved,
  ...formProps
}: Omit<ExpenseFormProps, "onSaved" | "onCancel" | "layout"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (expense: Expense) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogDescription>
            {expense ? "Update the details of this expense." : "Quickly add a new expense to this category."}
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts on close, so the form resets for each open. */}
        <ExpenseForm
          {...formProps}
          expense={expense}
          layout="dialog"
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
