"use client";

import { Loader2Icon, PlusIcon, ReceiptTextIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage, formatMoney } from "@/lib/format";
import { assetUrl, categoriesService, expensesService } from "@/services";
import type { Category, Expense, ReceiptReadResult } from "@/types";

interface Row {
  key: number;
  checked: boolean;
  title: string;
  amount: string;
  categoryId: string;
}

/** Shows what was read from a receipt as an editable list; nothing is saved until the user adds it. */
export function ReceiptReviewCard({
  result,
  categories,
  onAdded,
  onDiscard,
  onCategoryCreated,
}: {
  result: ReceiptReadResult;
  categories: Category[];
  onAdded: (expenses: Expense[]) => void;
  onDiscard: () => void;
  onCategoryCreated: () => void;
}) {
  // Never preselect a category the image didn't point to; the user picks one instead.
  const [defaultCategoryId, setDefaultCategoryId] = useState(result.category?.id ?? "");
  const [created, setCreated] = useState<Category | null>(null);
  const options = created && !categories.some((c) => c.id === created.id) ? [...categories, created] : categories;
  const nextKey = useRef(result.items.length + 2);
  const [rows, setRows] = useState<Row[]>(() =>
    (result.items.length
      ? result.items
      : [{ title: result.title, amount: result.total ?? 0, categoryId: null }]
    ).map((line, i) => ({
      key: i + 1,
      checked: true,
      title: line.title,
      amount: line.amount ? String(line.amount) : "",
      categoryId: line.categoryId ?? defaultCategoryId,
    })),
  );
  const [date, setDate] = useState(result.date);
  const [saving, setSaving] = useState(false);
  const missingCategory = result.writtenCategory && !result.category && !created ? result.writtenCategory : "";

  async function createWrittenCategory() {
    if (!result.newCategory) return;
    setSaving(true);
    try {
      const category = await categoriesService.create({
        ...result.newCategory,
        description: "",
        budgetLimit: null,
        status: "active",
        assignedUserIds: [],
      });
      setCreated(category);
      setDefaultCategoryId(category.id);
      setRows((prev) => prev.map((r) => (r.categoryId ? r : { ...r, categoryId: category.id })));
      toast.success(`Category "${category.name}" created`);
      onCategoryCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const update = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const isValid = (r: Row) => r.title.trim() !== "" && Number(r.amount) > 0 && r.categoryId !== "";
  const selected = rows.filter((r) => r.checked);
  const selectedTotal = selected.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const canAddSelected = selected.length > 0 && selected.every(isValid) && !!date;
  const canAddOne = selectedTotal > 0 && !!(selected[0]?.categoryId || defaultCategoryId) && !!date;

  async function save(entries: { categoryId: string; title: string; amount: number }[]) {
    setSaving(true);
    const saved: Expense[] = [];
    try {
      for (const e of entries) {
        saved.push(
          await expensesService.create(e.categoryId, {
            title: e.title.trim(),
            amount: e.amount,
            date,
            note: `From receipt: ${result.title}`.slice(0, 1000),
            receiptUrl: result.receiptUrl,
          }),
        );
      }
      toast.success(
        saved.length === 1
          ? `${formatMoney(saved[0].amount)} added to ${saved[0].category.name}`
          : `${saved.length} expenses added`,
      );
      onAdded(saved);
    } catch (err) {
      toast.error(errorMessage(err));
      if (saved.length) onAdded(saved);
    } finally {
      setSaving(false);
    }
  }

  const addSelected = () =>
    save(selected.map((r) => ({ categoryId: r.categoryId, title: r.title, amount: Number(r.amount) })));

  const addAsOne = () =>
    save([{ categoryId: selected[0]?.categoryId || defaultCategoryId, title: result.title, amount: selectedTotal }]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <a href={assetUrl(result.receiptUrl)} target="_blank" rel="noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(result.receiptUrl)} alt="Receipt" className="size-14 rounded-md border object-cover" />
        </a>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptTextIcon className="size-4 text-primary" /> {result.title}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.items.length
              ? `Found ${result.items.length} item${result.items.length === 1 ? "" : "s"}`
              : "No separate items found"}
            {result.total !== null && ` · Total ${formatMoney(result.total)}`}. Check the list, then add.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onDiscard} disabled={saving} aria-label="Discard receipt">
          <XIcon />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {missingCategory && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
            <span className="mr-auto">
              The image says category <b>“{missingCategory}”</b>, but there is no such category.{" "}
              {result.newCategory ? "Create it, or pick a category below." : "Pick a category below or ask an admin to create it."}
            </span>
            {result.newCategory && (
              <Button size="sm" onClick={createWrittenCategory} disabled={saving}>
                <PlusIcon /> Create “{missingCategory}”
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="receipt-date" className="text-muted-foreground">
            Date
          </label>
          <Input
            id="receipt-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-40"
          />
        </div>

        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:flex-nowrap">
              <Checkbox
                checked={r.checked}
                onCheckedChange={(v) => update(r.key, { checked: v === true })}
                aria-label={`Include ${r.title || "item"}`}
              />
              <Input
                value={r.title}
                onChange={(e) => update(r.key, { title: e.target.value })}
                placeholder="Description"
                aria-label="Description"
                className="h-8 min-w-0 flex-1"
                maxLength={200}
              />
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={r.amount}
                onChange={(e) => update(r.key, { amount: e.target.value })}
                placeholder="Amount"
                aria-label="Amount"
                className="h-8 w-28"
              />
              <Select value={r.categoryId} onValueChange={(v) => update(r.key, { categoryId: v })}>
                <SelectTrigger size="sm" className="w-40" aria-label="Category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <CategoryIcon icon={c.icon} /> {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                aria-label="Remove row"
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>

        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { key: nextKey.current++, checked: true, title: "", amount: "", categoryId: defaultCategoryId },
            ])
          }
        >
          <PlusIcon /> Add row
        </Button>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <span className="mr-auto text-sm text-muted-foreground">
            Selected: <b className="text-foreground">{formatMoney(selectedTotal)}</b>
          </span>
          <Button variant="outline" onClick={addAsOne} disabled={saving || !canAddOne}>
            Add as one expense
          </Button>
          <Button onClick={addSelected} disabled={saving || !canAddSelected}>
            {saving ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Add {selected.length === 1 ? "1 expense" : `${selected.length} expenses`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
