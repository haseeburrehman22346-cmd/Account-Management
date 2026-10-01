"use client";

import { ImageIcon, Loader2Icon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/format";
import { categoriesService } from "@/services";
import type { Category, CategoryImageResult } from "@/types";

interface Row {
  key: number;
  checked: boolean;
  name: string;
  budget: string;
  icon: string;
  color: string;
  duplicate: boolean;
}

/** Shows the categories read from an image as an editable list; nothing is created until the admin adds them. */
export function CategoryImageReviewCard({
  result,
  onCreated,
  onDiscard,
}: {
  result: CategoryImageResult;
  /** `finished` is false when some rows failed and the list stays open. */
  onCreated: (categories: Category[], finished: boolean) => void;
  onDiscard: () => void;
}) {
  const nextKey = useRef(result.categories.length + 1);
  const [rows, setRows] = useState<Row[]>(() =>
    result.categories.map((c, i) => ({
      key: i,
      checked: !c.duplicate,
      name: c.name,
      budget: c.budget ? String(c.budget) : "",
      icon: c.icon,
      color: c.color,
      duplicate: !!c.duplicate,
    })),
  );
  const [saving, setSaving] = useState(false);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const selected = rows.filter((r) => r.checked);
  const canCreate = selected.length > 0 && selected.every((r) => r.name.trim() !== "" && !(Number(r.budget) < 0));

  async function create() {
    setSaving(true);
    const created: Category[] = [];
    try {
      for (const r of selected) {
        created.push(
          await categoriesService.create({
            name: r.name.trim(),
            description: "",
            icon: r.icon,
            color: r.color,
            budgetLimit: Number(r.budget) > 0 ? Number(r.budget) : null,
            status: "active",
            assignedUserIds: [],
          }),
        );
      }
      toast.success(created.length === 1 ? `Category “${created[0].name}” created` : `${created.length} categories created`);
      onCreated(created, true);
    } catch (err) {
      toast.error(errorMessage(err));
      if (created.length) {
        onCreated(created, false);
        const done = new Set(created.map((c) => c.name));
        setRows((prev) => prev.filter((r) => !done.has(r.name.trim())));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-4 text-primary" /> Categories from image
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.categories.length
              ? `Found ${result.categories.length} categor${result.categories.length === 1 ? "y" : "ies"}. Check the list, then create.`
              : "No categories found in the image. Add them below."}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onDiscard} disabled={saving} aria-label="Discard">
          <XIcon />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="rounded-lg border p-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={r.checked}
                  onCheckedChange={(v) => update(r.key, { checked: v === true })}
                  aria-label={`Include ${r.name || "category"}`}
                />
                <CategoryIcon icon={r.icon} className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value, duplicate: false })}
                  placeholder="Category name"
                  aria-label="Category name"
                  className="h-8 min-w-0 flex-1"
                  maxLength={100}
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={r.budget}
                  onChange={(e) => update(r.key, { budget: e.target.value })}
                  placeholder="Budget"
                  aria-label="Monthly budget"
                  className="h-8 w-28"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  aria-label="Remove row"
                >
                  <Trash2Icon />
                </Button>
              </div>
              {r.duplicate && (
                <p className="mt-1 pl-7 text-xs text-amber-600 dark:text-amber-400">
                  A category with this name already exists.
                </p>
              )}
            </li>
          ))}
        </ul>

        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { key: nextKey.current++, checked: true, name: "", budget: "", icon: "folder", color: "slate", duplicate: false },
            ])
          }
        >
          <PlusIcon /> Add row
        </Button>

        <div className="flex justify-end border-t pt-3">
          <Button onClick={create} disabled={saving || !canCreate}>
            {saving ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Create {selected.length === 1 ? "1 category" : `${selected.length} categories`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
