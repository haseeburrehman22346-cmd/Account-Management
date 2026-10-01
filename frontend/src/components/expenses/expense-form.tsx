"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CategoryIcon } from "@/components/shared/category-icon";
import { errorMessage, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { expensesService } from "@/services";
import type { Category, Expense, UserRef } from "@/types";
import { ReceiptUpload } from "./receipt-upload";

export interface ExpenseFormProps {
  /** Pre-selected category; with `categories` the user can switch it (admin modal). */
  categoryId: string;
  categories?: Category[];
  /** Admin only: who paid. Omit to record the current user. */
  payers?: UserRef[];
  defaultPayerId?: string;
  withReceipt?: boolean;
  expense?: Expense;
  /** Pre-filled values for a new expense, e.g. from a voice entry. */
  defaults?: { title?: string; amount?: number | null; date?: string; note?: string | null; receiptUrl?: string | null };
  titleLabel?: string;
  submitLabel?: string;
  layout?: "dialog" | "panel";
  onSaved: (expense: Expense) => void;
  onCancel?: () => void;
}

export function ExpenseForm({
  categoryId: initialCategoryId,
  categories,
  payers,
  defaultPayerId,
  withReceipt,
  expense,
  defaults,
  titleLabel = "Description",
  submitLabel = "Save Expense",
  layout = "dialog",
  onSaved,
  onCancel,
}: ExpenseFormProps) {
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? initialCategoryId);
  const [title, setTitle] = useState(expense?.title ?? defaults?.title ?? "");
  const [amount, setAmount] = useState(expense?.amount.toString() ?? defaults?.amount?.toString() ?? "");
  const [date, setDate] = useState(expense?.date ?? defaults?.date ?? todayIso());
  const [note, setNote] = useState(expense?.note ?? defaults?.note ?? "");
  const [paidById, setPaidById] = useState(expense?.paidBy.id ?? defaultPayerId ?? "");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expense?.receiptUrl ?? defaults?.receiptUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const input = {
      title,
      amount: Number(amount),
      date,
      note: note.trim() || null,
      receiptUrl,
      ...(payers && paidById && { paidById }),
    };
    try {
      const saved = expense
        ? await expensesService.update(expense.id, input)
        : await expensesService.create(categoryId, input);
      toast.success(expense ? "Expense updated" : "Expense added");
      if (!expense) {
        setTitle("");
        setAmount("");
        setNote("");
        setReceiptUrl(null);
      }
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const panel = layout === "panel";

  return (
    <form onSubmit={submit} className="space-y-4">
      {categories && (
        <Field label="Category" htmlFor="expense-category">
          <Select value={categoryId} onValueChange={setCategoryId} disabled={!!expense}>
            <SelectTrigger id="expense-category" className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <CategoryIcon icon={c.icon} /> {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {panel && <DateField value={date} onChange={setDate} />}

      <Field label={titleLabel} htmlFor="expense-title">
        <Input
          id="expense-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={titleLabel === "Title" ? "e.g. Lunch" : "e.g. Lunch with team"}
          required
          autoFocus={!panel}
        />
      </Field>

      <div className={cn("grid gap-3", !panel && "sm:grid-cols-2")}>
        {!panel && <DateField value={date} onChange={setDate} />}
        <Field label="Amount (PKR)" htmlFor="expense-amount">
          <Input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="e.g. 850"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
      </div>

      {(payers || withReceipt) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {payers && (
            <Field label="Paid By" htmlFor="expense-paid-by">
              <Select value={paidById} onValueChange={setPaidById}>
                <SelectTrigger id="expense-paid-by" className="w-full">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {payers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {withReceipt && (
            <Field label="Receipt (Optional)" htmlFor="expense-receipt">
              <ReceiptUpload id="expense-receipt" value={receiptUrl} onChange={setReceiptUrl} onBusyChange={setUploading} />
            </Field>
          )}
        </div>
      )}

      <Field label="Notes (Optional)" htmlFor="expense-note">
        <Textarea
          id="expense-note"
          rows={panel ? 2 : 3}
          placeholder="e.g. Office lunch"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <ErrorAlert message={error} />

      <div className={cn("flex gap-2", panel ? "flex-col" : "justify-end")}>
        {onCancel && !panel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving || uploading} className={cn(panel && "h-10 w-full")}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Date" htmlFor="expense-date">
      <Input id="expense-date" type="date" value={value} max={todayIso()} onChange={(e) => onChange(e.target.value)} required />
    </Field>
  );
}
